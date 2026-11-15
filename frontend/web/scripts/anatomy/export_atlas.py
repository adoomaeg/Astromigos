"""AHI anatomy atlas: Blender stage of the asset pipeline.

Reads the Z-Anatomy Startup.blend, keeps only the physical anatomical bodies, groups them into
selectable structures, decimates, moves everything to the atlas frame and writes one raw GLB per
anatomical system plus atlas-meta.json. The Node stage (optimize.mjs) compresses the GLBs and
writes the final manifest.

Run (headless, safe: no embedded scripts are executed):
  blender --background --factory-startup --disable-autoexec Startup.blend \
      --python export_atlas.py -- --out <raw output dir> [--only skeletal,muscular] [--scale 1.0]

Atlas frame of the GLBs: meters, Y up, body facing +Z, feet on y = 0, centered on x = 0, z = 0.
Blender frame of the source: meters, Z up, body facing -Y, anatomical left on +X.
"""
import bpy
import bmesh
import json
import os
import re
import sys
import time
from mathutils import Matrix, Vector

T0 = time.time()


def log(*a):
    print('[atlas]', *a, flush=True)


def parse_args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    opts = {'out': None, 'only': None, 'scale': 1.0}
    i = 0
    while i < len(argv):
        k = argv[i]
        if k == '--out':
            opts['out'] = argv[i + 1]; i += 2
        elif k == '--only':
            opts['only'] = set(argv[i + 1].split(',')); i += 2
        elif k == '--scale':
            opts['scale'] = float(argv[i + 1]); i += 2
        else:
            raise SystemExit('unknown argument ' + k)
    if not opts['out']:
        raise SystemExit('--out <dir> is required')
    return opts


OPTS = parse_args()
OUT_DIR = os.path.abspath(OPTS['out'])
os.makedirs(OUT_DIR, exist_ok=True)

# ---------------------------------------------------------------------------------------------
# Budgets (final triangles per system) and labels
# ---------------------------------------------------------------------------------------------
SYSTEMS = [
    ('integumentary', 'Integumentary system (skin)', 47500),
    ('skeletal', 'Skeletal system', 185000),
    ('muscular', 'Muscular system', 300000),
    ('cardiovascular', 'Cardiovascular system', 90000),
    ('respiratory', 'Respiratory system', 45000),
    ('nervous', 'Nervous system', 135000),
    ('digestive', 'Digestive system', 42000),
    ('urinary', 'Urinary system', 6000),
    ('other', 'Endocrine, lymphoid and sense organs', 26000),
]
SYSTEM_BUDGET = {s: int(b * OPTS['scale']) for s, _, b in SYSTEMS}

# Neutral base colors per tissue class. The viewer replaces materials by tissue, these only make
# the raw files readable in any glTF viewer.
TISSUE_COLOR = {
    'skin': (0.80, 0.62, 0.52), 'bone': (0.89, 0.86, 0.78), 'cartilage': (0.78, 0.85, 0.88),
    'tooth': (0.95, 0.94, 0.90), 'muscle': (0.62, 0.22, 0.20), 'tendon': (0.86, 0.82, 0.74),
    'heart': (0.66, 0.16, 0.16), 'artery': (0.78, 0.12, 0.12), 'vein': (0.16, 0.26, 0.62),
    'lung': (0.85, 0.60, 0.60), 'airway': (0.80, 0.80, 0.86), 'brain': (0.86, 0.74, 0.72),
    'nerve': (0.93, 0.83, 0.38), 'liver': (0.48, 0.20, 0.16), 'kidney': (0.55, 0.26, 0.22),
    'gut': (0.82, 0.60, 0.52), 'gland': (0.80, 0.62, 0.36), 'eye': (0.92, 0.92, 0.94),
    'organ': (0.72, 0.48, 0.46),
}

# ---------------------------------------------------------------------------------------------
# Source object classification
# ---------------------------------------------------------------------------------------------
ALLOWED_TOP = {
    '1: Skeletal system': 1, '3: Joints': 3, '4: Muscular system': 4, '5: Cardiovascular system': 5,
    '6: Lymphoid organs': 6, '7: Nervous system & Sense organs': 7, '8: Visceral systems': 8,
    '9: Regions of human body': 9,
}
# Name suffixes of objects that are not anatomical bodies:
#   .j  empty helper meshes that draw the leader line of a label
#   .i  empty hidden helper meshes parented to sub labels
#   .g  group titles (text, or text converted to mesh)
#   .t / .s  text labels (FONT objects, never exported)
#   .ol .or .o1l ...  muscle origin maps painted on bones ("2: Muscular insertions")
#   .el .er .e1l ...  muscle end (insertion) maps painted on bones
NON_BODY_SUFFIX = re.compile(r'\.(j|i|g|t|s|st|[oe]\d*[lr])$')
SIDE_SUFFIX = re.compile(r'\.([lr])$')
LABEL_SUFFIX = re.compile(r'\.(g|t|s|st|j|i|l|r)$')


# object name -> number of the top level collection it is linked to (objects sit directly in them)
TOP_OF = {}
for _cname, _num in ALLOWED_TOP.items():
    _coll = bpy.data.collections.get(_cname)
    if _coll is None:
        raise SystemExit('Unexpected blend layout: collection "%s" not found' % _cname)
    for _o in _coll.objects:
        TOP_OF.setdefault(_o.name, _num)


def top_collection_of(obj):
    return TOP_OF.get(obj.name)


def base_name(name):
    return SIDE_SUFFIX.sub('', name)


def ancestors(obj):
    out = []
    p = obj.parent
    guard = 0
    while p is not None and guard < 40:
        out.append(LABEL_SUFFIX.sub('', p.name))
        p = p.parent
        guard += 1
    return out


def side_of(obj):
    m = SIDE_SUFFIX.search(obj.name)
    if m:
        return 'L' if m.group(1) == 'l' else 'R'
    return None


class Rule:
    __slots__ = ('id', 'name', 'system', 'tissue', 'sided', 'parent', 'weight', 'fixed', 'side')

    def __init__(self, id, name, system, tissue, sided=True, parent=None, weight=1.0, fixed=None, side=None):
        self.side = side  # explicit 'L' or 'R' when the id and name already carry the side
        self.id = id; self.name = name; self.system = system; self.tissue = tissue
        self.sided = sided; self.parent = parent; self.weight = weight
        self.fixed = fixed  # fixed triangle target, taken from the system budget before the others share it


def R(*a, **k):
    return Rule(*a, **k)


class Exclude:
    """License or scope exclusion that must be recorded in the manifest."""

    def __init__(self, reason):
        self.reason = reason


EX_EAR = Exclude('inner ear')
EX_KIDNEY = Exclude('kidney')
# The atlas stands for every crew member and no monitored metric relates to reproductive
# structures, so the shipped model is a neutral reference body.
EX_REPRO = Exclude('reproductive')
# vessels, nerves and ducts that only serve the external genitalia (they would also stick out of
# the neutral body surface)
REPRO_NAME = re.compile(r'testicular|penis|scrotal|prostat|deferens|external pudendal|genital branch')
# skin regions reshaped into a smooth neutral surface (see neutralize_groin)
NEUTRAL_SKIN = re.compile(r'^Urogenital region')

LIMB_BONES = {
    'Femur': 'femur', 'Fibula': 'fibula', 'Patella': 'patella', 'Tibia': 'tibia', 'Hip bone': 'hip-bone',
    'Humerus': 'humerus', 'Radius': 'radius', 'Ulna': 'ulna', 'Clavicle': 'clavicle', 'Scapula': 'scapula',
}


def rule_skeletal(n, anc):
    if 'Auditory ossicles' in anc:
        return EX_EAR
    if n.startswith('Sinus of') or 'cells of ethmoid' in n:
        return None  # air cavities, not bodies
    if 'Bones of cranium' in anc:
        return R('skull', 'Skull', 'skeletal', 'bone', False, weight=2.2)
    if n == 'Mandible':
        return R('mandible', 'Mandible', 'skeletal', 'bone', False, weight=1.3)
    if n == 'Hyoid bone':
        return R('hyoid-bone', 'Hyoid bone', 'skeletal', 'bone', False)
    if 'Teeth' in anc:
        if n.startswith('Upper'):
            return R('upper-teeth', 'Upper teeth', 'skeletal', 'tooth', False, weight=0.8)
        return R('lower-teeth', 'Lower teeth', 'skeletal', 'tooth', False, weight=0.8)
    if 'Laryngeal cartilages' in anc:
        return R('larynx', 'Larynx (laryngeal cartilages and epiglottis)', 'respiratory', 'cartilage', False)
    if 'Nasal cartilages' in anc:
        return R('nasal-cartilages', 'Nasal cartilages', 'skeletal', 'cartilage', False)
    if 'Cervical vertebrae' in anc:
        return R('cervical-vertebrae', 'Cervical vertebrae (C1 to C7)', 'skeletal', 'bone', False, weight=1.3)
    if 'Thoracic vertebrae' in anc:
        return R('thoracic-vertebrae', 'Thoracic vertebrae (T1 to T12)', 'skeletal', 'bone', False, weight=1.3)
    if 'Lumbar vertebrae' in anc:
        return R('lumbar-vertebrae', 'Lumbar vertebrae (L1 to L5)', 'skeletal', 'bone', False, weight=1.3)
    if n == 'Sacrum':
        return R('sacrum', 'Sacrum', 'skeletal', 'bone', False)
    if n == 'Coccyx':
        return R('coccyx', 'Coccyx', 'skeletal', 'bone', False)
    if 'Sternum' in anc:
        return R('sternum', 'Sternum', 'skeletal', 'bone', False)
    if 'Ribs' in anc:
        return R('ribs', 'Ribs', 'skeletal', 'bone', weight=0.8)
    if 'Costal cartilages' in anc:
        return R('costal-cartilages', 'Costal cartilages', 'skeletal', 'cartilage')
    if n in LIMB_BONES:
        return R(LIMB_BONES[n], n, 'skeletal', 'bone', weight=3.0)  # low poly upstream: keep them almost intact
    if 'Bones of foot' in anc:
        return R('bones-of-{s}-foot', 'Bones of {s} foot', 'skeletal', 'bone', weight=1.3)
    if 'Bones of free part of upper limb' in anc:
        return R('bones-of-{s}-hand', 'Bones of {s} hand', 'skeletal', 'bone', weight=1.5)
    return 'UNMATCHED'


def rule_joints(n, anc):
    if n.startswith('Intervertebral disc'):
        return R('intervertebral-discs', 'Intervertebral discs', 'skeletal', 'cartilage', False, weight=0.6)
    return None  # ligaments, capsules and membranes are left out (they hide the bones)


def rule_muscular(n, anc):
    low = n.lower()
    A = lambda *keys: any(k in anc for k in keys)
    M = lambda id, name, sided=True, tissue='muscle', weight=1.0: R(id, name, 'muscular', tissue, sided, weight=weight)
    if A('Fasciae', 'Bursae of lower limb', 'Bursae of upper limb', 'Tendon sheaths of lower limb', 'Tendon sheaths of upper limb'):
        return None  # fasciae wrap whole limbs and hide the muscles; bursae and sheaths are tiny
    if low == 'diaphragm':
        return R('diaphragm', 'Diaphragm', 'respiratory', 'muscle', False, weight=1.2)
    # thorax
    if A('Pectoralis major muscle'):
        return M('pectoralis-major', 'Pectoralis major', weight=1.3)
    if 'intercostal' in low or low.startswith('transversus thoracis') or A('Levatores costarum'):
        return M('intercostal-muscles', 'Intercostal muscles', weight=0.7)
    if low.startswith('pectoralis minor'):
        return M('pectoralis-minor', 'Pectoralis minor')
    if low.startswith('serratus anterior'):
        return M('serratus-anterior', 'Serratus anterior')
    if low.startswith('subclavius'):
        return M('subclavius', 'Subclavius')
    # lower limb
    if A('Medial compartment of thigh'):
        if low.startswith('gracilis'):
            return M('gracilis', 'Gracilis')
        if low.startswith('obturator externus'):
            return M('deep-rotators-of-{s}-hip', 'Deep rotator muscles of {s} hip')
        return M('adductor-muscles-of-{s}-thigh', 'Adductor muscles of {s} thigh')
    if A('Muscles of foot'):
        return M('muscles-of-{s}-foot', 'Muscles of {s} foot')
    if A('Superficial part of posterior compartment of leg'):
        if 'gastrocnemius' in low:
            return M('gastrocnemius', 'Gastrocnemius', weight=1.2)
        if low.startswith('soleus'):
            return M('soleus', 'Soleus')
        if low.startswith('calcaneal tendon'):
            return M('calcaneal-tendon', 'Calcaneal (Achilles) tendon', tissue='tendon')
        return M('deep-posterior-muscles-of-{s}-leg', 'Deep posterior muscles of {s} leg')
    if A('Deep part of posterior compartment of leg'):
        return M('deep-posterior-muscles-of-{s}-leg', 'Deep posterior muscles of {s} leg')
    if A('Anterior compartment of leg'):
        if low.startswith('tibialis anterior'):
            return M('tibialis-anterior', 'Tibialis anterior')
        return M('extensor-muscles-of-{s}-leg', 'Extensor muscles of {s} leg')
    if A('Lateral compartment of leg'):
        return M('fibularis-muscles', 'Fibularis (peroneal) muscles')
    if A('Superficial gluteal muscles'):
        if low.startswith('gluteus maximus'):
            return M('gluteus-maximus', 'Gluteus maximus', weight=1.3)
        if low.startswith('gluteus medius'):
            return M('gluteus-medius', 'Gluteus medius')
        if low.startswith('gluteus minimus'):
            return M('gluteus-minimus', 'Gluteus minimus')
        return M('tensor-fasciae-latae', 'Tensor fasciae latae and iliotibial tract', weight=0.8)
    if A('Iliopsoas muscle'):
        return M('iliopsoas', 'Iliopsoas')
    if A('Deep gluteal muscles'):
        return M('deep-rotators-of-{s}-hip', 'Deep rotator muscles of {s} hip')
    if A('Anterior compartment of thigh'):
        if low.startswith('sartorius'):
            return M('sartorius', 'Sartorius')
        return M('quadriceps-femoris', 'Quadriceps femoris', weight=1.5)
    if A('Posterior compartment of thigh'):
        if 'biceps femoris' in low:
            return M('biceps-femoris', 'Biceps femoris', weight=1.2)
        if low.startswith('semimembranosus'):
            return M('semimembranosus', 'Semimembranosus')
        return M('semitendinosus', 'Semitendinosus')
    # upper limb
    if A('Muscles of hand'):
        return M('muscles-of-{s}-hand', 'Muscles of {s} hand')
    if A('Posterior compartment of forearm'):
        if low.startswith('brachioradialis'):
            return M('brachioradialis', 'Brachioradialis')
        return M('extensor-muscles-of-{s}-forearm', 'Extensor muscles of {s} forearm', weight=1.2)
    if A('Anterior compartment of forearm'):
        return M('flexor-muscles-of-{s}-forearm', 'Flexor muscles of {s} forearm', weight=1.2)
    if A('Deltoid muscle'):
        return M('deltoid', 'Deltoid', weight=1.3)
    if low.startswith('teres major'):
        return M('teres-major', 'Teres major')
    if A('Rotator cuff muscles'):
        for key in ('infraspinatus', 'subscapularis', 'supraspinatus', 'teres minor'):
            if low.startswith(key):
                return M(key.replace(' ', '-'), key.capitalize())
    if A('Biceps brachii muscle'):
        return M('biceps-brachii', 'Biceps brachii', weight=1.3)
    if low.startswith('brachialis'):
        return M('brachialis', 'Brachialis')
    if low.startswith('coracobrachialis'):
        return M('coracobrachialis', 'Coracobrachialis')
    if A('Triceps brachii muscle'):
        return M('triceps-brachii', 'Triceps brachii', weight=1.3)
    # neck
    if A('Muscles of neck'):
        if low.startswith('sternocleidomastoid'):
            return M('sternocleidomastoid', 'Sternocleidomastoid')
        if low.startswith('platysma'):
            return M('platysma', 'Platysma', weight=0.7)
        if low.startswith('scalenus'):
            return M('scalene-muscles', 'Scalene muscles')
        if A('Suprahyoid muscles'):
            return M('suprahyoid-muscles', 'Suprahyoid muscles')
        if A('Infrahyoid muscles'):
            return M('infrahyoid-muscles', 'Infrahyoid muscles')
        if A('Laryngeal muscles'):
            return M('muscles-of-larynx', 'Muscles of larynx', sided=False, weight=0.6)
        if A('Pharyngeal muscles'):
            return M('muscles-of-pharynx', 'Muscles of pharynx and soft palate', sided=False, weight=0.6)
        return M('prevertebral-muscles', 'Prevertebral muscles')
    # back
    if A('Trapezius muscle'):
        return M('trapezius', 'Trapezius', weight=1.3)
    if low.startswith('latissimus dorsi'):
        return M('latissimus-dorsi', 'Latissimus dorsi', weight=1.2)
    if low.startswith('levator scapulae'):
        return M('levator-scapulae', 'Levator scapulae')
    if low.startswith('rhomboid'):
        return M('rhomboid-muscles', 'Rhomboid muscles')
    if low.startswith('serratus posterior'):
        return M('serratus-posterior-muscles', 'Serratus posterior muscles')
    if A('Erector spinae'):
        return M('erector-spinae', 'Erector spinae', weight=1.2)
    if A('Suboccipital muscles'):
        return M('suboccipital-muscles', 'Suboccipital muscles')
    if A('Splenius muscles'):
        return M('splenius-muscles', 'Splenius muscles')
    if A('Transversospinal muscles', 'Interspinales muscles') or 'intertransversarii' in low:
        return M('deep-back-muscles', 'Deep back muscles (transversospinal group)')
    # head
    if A('Facial muscles', 'Epicranius muscle'):
        return M('facial-muscles', 'Muscles of facial expression', weight=1.2)
    if A('Extra-ocular muscles'):
        return M('extraocular-muscles', 'Extraocular muscles', weight=0.7)
    if A('Masticatory muscles'):
        if low.startswith('temporalis'):
            return M('temporalis', 'Temporalis')
        if 'masseter' in low:
            return M('masseter', 'Masseter')
        return M('pterygoid-muscles', 'Pterygoid muscles')
    if A('Muscles of tongue'):
        return M('muscles-of-tongue', 'Extrinsic muscles of tongue', sided=False)
    if A('Muscles of soft palate'):
        return M('muscles-of-pharynx', 'Muscles of pharynx and soft palate', sided=False, weight=0.6)
    if A('Muscles of pelvis'):
        return M('pelvic-floor-muscles', 'Pelvic floor muscles', sided=False)
    # abdomen
    if A('Muscles of abdomen'):
        if low.startswith('external abdominal oblique') or low.startswith('inguinal ligament'):
            return M('external-oblique', 'External abdominal oblique')
        if low.startswith('internal abdominal oblique'):
            return M('internal-oblique', 'Internal abdominal oblique')
        if low.startswith('transversus abdominis'):
            return M('transversus-abdominis', 'Transversus abdominis')
        if low.startswith('quadratus lumborum'):
            return M('quadratus-lumborum', 'Quadratus lumborum')
        return M('rectus-abdominis', 'Rectus abdominis', sided=False, weight=1.4)
    return 'UNMATCHED'


def rule_cardio(n, anc):
    low = n.lower()
    A = lambda *keys: any(k in anc for k in keys)
    C = lambda id, name, tissue, sided=False, parent=None, weight=1.0: R(id, name, 'cardiovascular', tissue, sided, parent, weight)
    if REPRO_NAME.search(low):
        return EX_REPRO
    if 'intrarenal' in low:
        return EX_KIDNEY  # traced inside the excluded kidney model, would poke out of the procedural kidney
    if A('Heart'):
        return C('heart', 'Heart', 'heart', weight=3.0)
    if A('Arteries of heart'):
        return C('coronary-arteries', 'Coronary arteries', 'artery', parent='heart')
    if A('Cardiac veins'):
        return C('cardiac-veins', 'Cardiac veins', 'vein', parent='heart')
    if A('Pulmonary arteries'):
        return C('pulmonary-arteries', 'Pulmonary arteries', 'artery')
    if A('Pulmonary veins'):
        return C('pulmonary-veins', 'Pulmonary veins', 'vein')
    venous = A('Venous system')
    if not venous:
        if n in ('Ascending aorta', 'Aortic arch', 'Thoracic aorta', 'Abdominal aorta'):
            return C('aorta', 'Aorta', 'artery', weight=2.0)
        if A('Cerebral arterial circle', 'Basilar artery') or n == 'Basilar artery' or 'cerebral' in low or \
                A('Middle cerebral artery (M1-segment)', 'Anterior cerebral artery', 'Posterior cerebral artery'):
            return C('arteries-of-brain', 'Arteries of brain', 'artery')
        if A('Internal carotid artery') and not A('Ophthalmic artery') and not low.startswith('ophthalmic'):
            return C('arteries-of-brain', 'Arteries of brain', 'artery')
        if A('Left common carotid artery', 'Right common carotid artery') or 'common carotid' in low or \
                A('Vertebral artery', 'Thyrocervical trunk', 'Costocervical trunk') or \
                low.startswith(('vertebral artery', 'thyrocervical', 'costocervical')):
            return C('arteries-of-{s}-head-and-neck', 'Arteries of head and neck, {s} side', 'artery', True)
        if A('Axillary artery') or low.startswith(('axillary artery', 'left subclavian', 'right subclavian')):
            return C('arteries-of-{s}-upper-limb', 'Arteries of {s} upper limb', 'artery', True)
        if A('Femoral artery') or low.startswith('femoral artery'):
            return C('arteries-of-{s}-lower-limb', 'Arteries of {s} lower limb', 'artery', True)
        if A('Aortic bifurcation'):
            return C('arteries-of-pelvis', 'Arteries of pelvis (iliac arteries)', 'artery')
        if A('Abdominal aorta'):
            return C('arteries-of-abdomen', 'Arteries of abdomen', 'artery')
        if A('Thoracic aorta', 'Internal thoracic artery', 'Arteries of spinal cord', 'Aortic arch') or low.startswith('internal thoracic'):
            return C('arteries-of-thorax', 'Arteries of thorax', 'artery')
        return 'UNMATCHED'
    # veins
    if n == 'Superior vena cava':
        return C('superior-vena-cava', 'Superior vena cava', 'vein', weight=2.0)
    if n.startswith('Inferior vena cava'):
        return C('inferior-vena-cava', 'Inferior vena cava', 'vein', weight=2.0)
    if A('Dural venous sinuses', 'Cranial veins'):
        return C('veins-of-brain', 'Dural venous sinuses and cranial veins', 'vein')
    if A('Internal jugular vein', 'External jugular vein', 'Vertebral vein') or \
            low.startswith(('internal jugular', 'external jugular', 'vertebral vein')):
        return C('veins-of-{s}-head-and-neck', 'Veins of head and neck, {s} side', 'vein', True)
    if A('Axillary vein') or low.startswith(('axillary vein', 'left subclavian', 'right subclavian')):
        return C('veins-of-{s}-upper-limb', 'Veins of {s} upper limb', 'vein', True)
    if A('Femoral vein') or low.startswith('femoral vein'):
        return C('veins-of-{s}-lower-limb', 'Veins of {s} lower limb', 'vein', True)
    if A('Common iliac vein') or low.startswith('common iliac vein'):
        return C('veins-of-pelvis', 'Veins of pelvis (iliac veins)', 'vein')
    if A('Hepatic portal vein', 'Tributaries of hepatic portal vein') or low.startswith('hepatic portal'):
        return C('hepatic-portal-vein', 'Hepatic portal vein and tributaries', 'vein')
    if A('Inferior vena cava (abdominal part)', 'Inferior vena cava (thoracic part)'):
        return C('veins-of-abdomen', 'Veins of abdomen', 'vein')
    if A('Superior vena cava'):
        return C('veins-of-thorax', 'Veins of thorax (brachiocephalic and azygos veins)', 'vein')
    return 'UNMATCHED'


def rule_lymphoid(n, anc):
    if n == 'Spleen':
        return R('spleen', 'Spleen', 'other', 'organ', False, weight=1.5)
    if 'thymus' in n.lower():
        return R('thymus', 'Thymus', 'other', 'gland', False)
    return None  # lymph nodes and tonsils are left out


CORTEX_GROUPS = ('Frontal lobe', 'Parietal lobe', 'Occipital lobe', 'Temporal lobe', 'Insula', 'Limbic lobe', 'Interlobar sulci')
DEEP_NAME = 'Deep structures of cerebrum (thalamus, basal nuclei, corpus callosum)'


def rule_nervous(n, anc):
    low = n.lower()
    A = lambda *keys: any(k in anc for k in keys)
    N = lambda id, name, tissue, sided=False, parent=None, weight=1.0: R(id, name, 'nervous', tissue, sided, parent, weight)
    if REPRO_NAME.search(low):
        return EX_REPRO
    if A('Ear', 'Internal ear', 'Middle ear', 'External ear') or low in ('cochlear nerve', 'vestibular nerve'):
        return EX_EAR
    if A('Meninges'):
        return None  # dura and pia wrap the brain and the cord
    if 'ventricle' in low or low.startswith('aqueduct') or low.startswith('central canal'):
        return None  # cavities
    if A('Telencephalon'):
        if low == 'hippocampus':
            return N('cerebrum-deep-structures', DEEP_NAME, 'brain', parent='brain')
        if A(*CORTEX_GROUPS):
            return R('brain', 'Brain (cerebrum)', 'nervous', 'brain', False, fixed=66000)  # gyri need density
        if low.startswith('white matter of telencephalon'):
            return None  # inner white matter surface, hidden under the cortex
        return N('cerebrum-deep-structures', DEEP_NAME, 'brain', parent='brain')
    if A('Diencephalon'):
        return N('cerebrum-deep-structures', DEEP_NAME, 'brain', parent='brain')
    if A('Brainstem'):
        if 'nucle' in low:
            return None
        return N('brainstem', 'Brainstem', 'brain', weight=1.5)
    if A('Cerebellum'):
        return N('cerebellum', 'Cerebellum', 'brain', weight=1.6)
    if A('Spinal cord'):
        if low == 'white matter of spinal cord':
            return N('spinal-cord', 'Spinal cord', 'nerve', weight=1.5)
        return None
    if low == 'cauda equina':
        return N('spinal-cord', 'Spinal cord', 'nerve', weight=1.5)
    if A('Cranial nerves', 'Cervical nerves'):
        return N('cranial-nerves', 'Cranial nerves', 'nerve', True)
    if A('Brachial plexus'):
        return N('nerves-of-{s}-upper-limb', 'Nerves of {s} upper limb (brachial plexus)', 'nerve', True)
    if A('Lumbosacral plexus', 'Lumbar nerves'):
        return N('nerves-of-{s}-lower-limb', 'Nerves of {s} lower limb (lumbosacral plexus)', 'nerve', True)
    if A('Thoracic nerves'):
        return N('intercostal-nerves', 'Intercostal nerves', 'nerve', True)
    if A('Autonomic division of peripheral nervous system'):
        return N('sympathetic-trunk', 'Sympathetic trunk', 'nerve', True)
    if A('Spinal nerves', 'Ganglia', 'Roots of nerves'):
        return N('spinal-nerve-roots', 'Spinal nerve roots and ganglia', 'nerve', True)
    if A('Eyeball'):
        if low in ('sclera', 'cornea', 'iris', 'lens'):
            return R('eye', 'Eye', 'other', 'eye', True, weight=0.6)
        return None
    if A('Eye', 'Sense organs'):
        return None
    return 'UNMATCHED'


def rule_visceral(n, anc):
    low = n.lower()
    A = lambda *keys: any(k in anc for k in keys)
    D = lambda id, name, tissue, weight=1.0: R(id, name, 'digestive', tissue, False, weight=weight)
    if low == 'kidney' or low == 'renal pelvis':
        return EX_KIDNEY
    if A('Urinary system'):
        if low.startswith('ureter'):
            return R('ureters', 'Ureters', 'urinary', 'organ', False)
        if low == 'urethra':
            return EX_REPRO  # male course through the external genitalia, outside the neutral surface
        return R('urinary-bladder', 'Urinary bladder', 'urinary', 'organ', False, weight=1.5)
    if A('Abdominopelvic cavity', 'Thoracic cavity', 'Peritoneal structures'):
        return None  # peritoneum, omentum and pleura wrap the organs
    if A('Lungs'):
        if 'left lung' in low:
            return R('lung-left', 'Left lung', 'respiratory', 'lung', False, weight=2.0, side='L')
        return R('lung-right', 'Right lung', 'respiratory', 'lung', False, weight=2.0, side='R')
    if low == 'trachea':
        return R('trachea', 'Trachea', 'respiratory', 'airway', False)
    if A('Bronchi'):
        return R('bronchi', 'Bronchi', 'respiratory', 'airway', False)
    if low == 'epiglottis':
        return R('larynx', 'Larynx (laryngeal cartilages and epiglottis)', 'respiratory', 'cartilage', False)
    if A('Respiratory system'):
        return None  # nasal mucosa
    if A('Endocrine glands'):
        if 'thyroid' in low:
            return R('thyroid', 'Thyroid and parathyroid glands', 'other', 'gland', False)
        if low == 'suprarenal gland':
            return R('adrenal-gland', 'Adrenal (suprarenal) gland', 'other', 'gland', True)
        if low == 'pineal gland':
            return R('pineal-gland', 'Pineal gland', 'other', 'gland', False)
        return R('pituitary-gland', 'Pituitary gland', 'other', 'gland', False)
    if A('Genital systems'):
        return EX_REPRO
    if A('Digestive system'):
        if low == 'liver':
            return D('liver', 'Liver', 'liver', 2.0)
        if 'segment of liver' in low:
            return None  # duplicates of the liver surface
        if low in ('gallbladder', 'bile duct'):
            return D('gallbladder', 'Gallbladder and bile duct', 'organ')
        if low == 'pancreas':
            return D('pancreas', 'Pancreas', 'gland')
        if 'pancreatic duct' in low:
            return None
        if low == 'stomach':
            return D('stomach', 'Stomach', 'gut', 1.5)
        if low == 'oesophagus':
            return D('esophagus', 'Esophagus', 'gut')
        if A('Small intestine'):
            return D('small-intestine', 'Small intestine', 'gut', 1.5)
        if A('Taeniae coli'):
            return None
        if A('Large intestine'):
            return D('large-intestine', 'Large intestine', 'gut', 1.5)
        if A('Pharynx'):
            return D('pharynx', 'Pharynx', 'gut')
        if A('Salivary glands'):
            return D('salivary-glands', 'Salivary glands', 'gland')
        if low == 'tongue':
            return D('tongue', 'Tongue', 'organ')
        return None  # gingiva, soft palate, uvula
    return 'UNMATCHED'


def rule_regions(n, anc):
    if 'Hairs' in anc:
        return None
    return R('skin', 'Skin (body surface)', 'integumentary', 'skin', False)


RULES = {1: rule_skeletal, 3: rule_joints, 4: rule_muscular, 5: rule_cardio, 6: rule_lymphoid,
         7: rule_nervous, 8: rule_visceral, 9: rule_regions}

SIDE_WORD = {'L': 'left', 'R': 'right'}


def world_center_x(obj):
    bb = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    return sum(v.x for v in bb) / 8.0


def resolve_side(obj, n):
    s = side_of(obj)
    if s:
        return s
    low = n.lower()
    if low.startswith('left ') or ' of left ' in low:
        return 'L'
    if low.startswith('right ') or ' of right ' in low:
        return 'R'
    p = obj.parent
    guard = 0
    while p is not None and guard < 40:
        ps = side_of(p)
        if ps:
            return ps
        pl = p.name.lower()
        if pl.startswith('left ') or ' of left ' in pl:
            return 'L'
        if pl.startswith('right ') or ' of right ' in pl:
            return 'R'
        p = p.parent
        guard += 1
    x = world_center_x(obj)
    if x > 0.004:
        return 'L'
    if x < -0.004:
        return 'R'
    return None


def structure_key(rule, side):
    if rule.side:
        return rule.id, rule.name, rule.side
    if not rule.sided or side is None:
        sid = rule.id.replace('-{s}', '').replace('{s}-', '')
        name = rule.name.replace(', {s} side', '').replace('{s} ', '')
        return sid, name, None
    w = SIDE_WORD[side]
    if '{s}' in rule.id:
        return rule.id.format(s=w), rule.name.format(s=w), side
    nm = rule.name
    return rule.id + '-' + w, w.capitalize() + ' ' + nm[0].lower() + nm[1:], side


# ---------------------------------------------------------------------------------------------
# 1. Classify every object
# ---------------------------------------------------------------------------------------------
structures = {}   # id -> dict
excluded = {'inner ear': [], 'kidney': [], 'reproductive': []}
unmatched = []
kidney_src = {}

for obj in bpy.data.objects:
    if obj.type not in ('MESH', 'CURVE'):
        continue
    if NON_BODY_SUFFIX.search(obj.name):
        continue
    top = top_collection_of(obj)
    if top is None:
        continue
    if obj.type == 'MESH' and len(obj.data.polygons) == 0:
        continue
    n = base_name(obj.name)
    anc = ancestors(obj)
    res = RULES[top](n, anc)
    if res is None:
        continue
    if isinstance(res, Exclude):
        excluded[res.reason].append(obj.name)
        if res.reason == 'kidney' and n == 'Kidney':
            kidney_src[side_of(obj)] = obj
        continue
    if res == 'UNMATCHED':
        unmatched.append((top, obj.name, anc[:3]))
        continue
    side = resolve_side(obj, n) if res.sided else None
    sid, name, side = structure_key(res, side)
    st = structures.get(sid)
    if st is None:
        st = structures[sid] = {'id': sid, 'name': name, 'system': res.system, 'tissue': res.tissue, 'side': side,
                                'parent': res.parent, 'weight': res.weight, 'fixed': res.fixed, 'objects': []}
    st['objects'].append(obj)

if OPTS['only']:
    structures = {k: v for k, v in structures.items() if v['system'] in OPTS['only']}

log('classified', round(time.time() - T0, 1), 's')
log('structures', len(structures), 'source objects', sum(len(s['objects']) for s in structures.values()))
log('excluded', {k: len(v) for k, v in excluded.items()})
for u in unmatched:
    log('UNMATCHED', u)

# ---------------------------------------------------------------------------------------------
# 2. Evaluate the kept objects in a controlled view layer
# ---------------------------------------------------------------------------------------------
# A new empty scene keeps the dependency graph limited to the objects linked below (the original
# scene carries thousands of labels and helpers).
scene = bpy.data.scenes.new('ATLAS')
bpy.context.window.scene = scene
view_layer = scene.view_layers[0]

log('work scene ready', round(time.time() - T0, 1), 's')
src_coll = bpy.data.collections.new('ATLAS_SRC')  # linked to the scene only once it is filled (much faster)
out_coll = bpy.data.collections.new('ATLAS_OUT')
scene.collection.children.link(out_coll)

UNSAFE_MODS = {'BOOLEAN', 'NODES', 'SKIN', 'WIREFRAME', 'DECIMATE', 'HOOK'}
MIN_TUBE_RADIUS = 0.00055  # meters


def prepare(obj, st):
    obj.hide_viewport = False
    obj.hide_render = False
    for m in obj.modifiers:
        if m.type in UNSAFE_MODS:
            m.show_viewport = False
        elif m.type == 'SUBSURF':
            m.levels = min(m.levels, 1)
        elif m.type == 'SOLIDIFY' and st is not None and st['tissue'] == 'skin':
            m.show_viewport = False  # the skin stays a single surface (no inner shell)
    if obj.type == 'CURVE':
        cu = obj.data
        if cu.bevel_mode == 'ROUND' and cu.bevel_depth > 0:
            # thin vessels and nerves get a minimum radius so they survive at full body zoom
            floor = MIN_TUBE_RADIUS / cu.bevel_depth
            for sp in cu.splines:
                for p in sp.bezier_points:
                    if p.radius < floor:
                        p.radius = floor
                for p in sp.points:
                    if p.radius < floor:
                        p.radius = floor
        maxr = 0.0
        for sp in cu.splines:
            for p in sp.bezier_points:
                maxr = max(maxr, p.radius)
            for p in sp.points:
                maxr = max(maxr, p.radius)
        r = cu.bevel_depth * (maxr if maxr > 0 else 1.0)
        if cu.bevel_mode == 'OBJECT' or r > 0.004:
            cu.bevel_resolution = 2; cu.resolution_u = 6   # 8 sided
        elif r > 0.0011:
            cu.bevel_resolution = 1; cu.resolution_u = 3   # 6 sided
        else:
            cu.bevel_resolution = 0; cu.resolution_u = 3   # 4 sided
        cu.use_fill_caps = True


linked = set()
for st in structures.values():
    for obj in st['objects']:
        if obj.name not in linked:
            src_coll.objects.link(obj)
            linked.add(obj.name)
        prepare(obj, st)
for obj in kidney_src.values():
    if obj.name not in linked:
        src_coll.objects.link(obj)
        linked.add(obj.name)
    prepare(obj, None)

scene.collection.children.link(src_coll)
log('objects linked and prepared', round(time.time() - T0, 1), 's')
view_layer.update()
dg = view_layer.depsgraph
log('depsgraph ready', round(time.time() - T0, 1), 's')


def append_world_mesh(bm, obj):
    """Appends the evaluated mesh of obj to bm in world space with correct winding. Returns the face count."""
    ev = obj.evaluated_get(dg)
    me = ev.to_mesh()
    if me is None or len(me.polygons) == 0:
        ev.to_mesh_clear()
        return 0
    nv = len(bm.verts)
    nf = len(bm.faces)
    bm.from_mesh(me)
    ev.to_mesh_clear()
    bm.verts.ensure_lookup_table()
    bm.faces.ensure_lookup_table()
    mw = obj.matrix_world
    bmesh.ops.transform(bm, matrix=mw, verts=bm.verts[nv:])
    if mw.determinant() < 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces[nf:])
    return len(bm.faces) - nf


# kidney bounding boxes (numbers only: the geometry itself is never exported)
kidney_boxes = {}
for side, obj in kidney_src.items():
    kbm = bmesh.new()
    append_world_mesh(kbm, obj)
    xs = [v.co for v in kbm.verts]
    kidney_boxes[side] = ([min(c[i] for c in xs) for i in range(3)], [max(c[i] for c in xs) for i in range(3)])
    kbm.free()

materials = {}


def tissue_material(tissue):
    m = materials.get(tissue)
    if m is None:
        m = bpy.data.materials.new('tissue-' + tissue)
        m.use_nodes = True
        bsdf = m.node_tree.nodes.get('Principled BSDF')
        c = TISSUE_COLOR[tissue]
        bsdf.inputs['Base Color'].default_value = (c[0], c[1], c[2], 1.0)
        bsdf.inputs['Roughness'].default_value = 0.6
        bsdf.inputs['Metallic'].default_value = 0.0
        materials[tissue] = m
    return m


neutral_skin_objects = []


def neutralize_groin(bm, layer):
    """Replaces the external genital region of the body surface by a smooth neutral surface.

    The faces of that region are removed and the opening is closed with a new patch: concentric
    rings from the border of the region to its center, relaxed until every new vertex sits at the
    average of its neighbours (the smooth membrane that spans the border). A second pass smooths
    the patch together with a few rings of surrounding skin so it blends into the lower abdomen,
    the perineum and the inner thighs. The skin stays one single surface.
    """
    region = [f for f in bm.faces if f[layer]]
    if not region:
        return
    # border of the region: edges used by exactly one region face
    edges = {e for f in region for e in f.edges}
    border = [e for e in edges if sum(1 for f in e.link_faces if f[layer]) == 1]
    adj = {}
    for e in border:
        v0, v1 = e.verts
        adj.setdefault(v0, []).append(v1)
        adj.setdefault(v1, []).append(v0)
    loops = []
    seen = set()
    for start in adj:
        if start in seen:
            continue
        loop = [start]
        seen.add(start)
        prev, cur = None, start
        while True:
            nxt = [n for n in adj[cur] if n is not prev and n not in seen]
            if not nxt:
                break
            prev, cur = cur, nxt[0]
            loop.append(cur)
            seen.add(cur)
        loops.append(loop)
    # The region meets the rest of the skin along closed loops (two upstream: one on the pubic
    # surface, one under it between the thighs). Each loop is closed with its own patch.
    loops = [lp for lp in loops if len(lp) >= 3 and lp[0] in adj[lp[-1]]]
    bmesh.ops.delete(bm, geom=region, context='FACES_ONLY')

    patch = []
    movable = []
    anchors = []
    for loop in loops:
        n = len(loop)
        center = Vector((0.0, 0.0, 0.0))
        for v in loop:
            center += v.co
        center /= n
        count = max(3, n // 4)
        rings = [loop]
        for k in range(1, count):
            t = k / count
            rings.append([bm.verts.new(v.co.lerp(center, t)) for v in loop])
        hub = bm.verts.new(center)
        for k in range(count - 1):
            outer, inner = rings[k], rings[k + 1]
            for i in range(n):
                j = (i + 1) % n
                patch.append(bm.faces.new((outer[i], outer[j], inner[j], inner[i])))
        last = rings[-1]
        for i in range(n):
            patch.append(bm.faces.new((last[i], last[(i + 1) % n], hub)))
        movable += [v for ring in rings[1:] for v in ring] + [hub]
        anchors += loop
    # Upstream the loops do not share an edge everywhere: a small opening is left between them.
    # Any closed rim made of border edges next to the patches is filled and joins the relaxation.
    near = set(anchors) | {e.other_vert(v) for v in anchors for e in v.link_edges}
    rim = [e for e in bm.edges if e.is_boundary and e.verts[0] in near and e.verts[1] in near]
    extra = bmesh.ops.holes_fill(bm, edges=rim, sides=40)['faces'] if rim else []
    if extra:
        poked = bmesh.ops.poke(bm, faces=extra)
        patch += poked['faces']
        movable += poked['verts']
    for f in patch:
        f[layer] = 1
    # leftovers of the removed region (inner vertices and edges)
    loose_edges = [e for e in bm.edges if not e.link_faces]
    if loose_edges:
        bmesh.ops.delete(bm, geom=loose_edges, context='EDGES')
    loose_verts = [v for v in bm.verts if not v.link_faces]
    if loose_verts:
        bmesh.ops.delete(bm, geom=loose_verts, context='VERTS')

    neighbours = {v: [e.other_vert(v) for e in v.link_edges] for v in movable}
    for _ in range(800):  # Gauss-Seidel relaxation toward the harmonic surface
        for v in movable:
            ns = neighbours[v]
            acc = Vector((0.0, 0.0, 0.0))
            for nb in ns:
                acc += nb.co
            v.co = acc / len(ns)
    # blend: the patch plus three rings of surrounding skin
    area = set(movable) | set(anchors)
    for _ in range(3):
        area |= {e.other_vert(v) for v in area for e in v.link_edges}
    area = [v for v in area if not v.is_boundary]
    ring_of = {v: [e.other_vert(v) for e in v.link_edges] for v in area}
    for _ in range(10):
        moved = {}
        for v in area:
            ns = ring_of[v]
            acc = Vector((0.0, 0.0, 0.0))
            for nb in ns:
                acc += nb.co
            moved[v] = v.co.lerp(acc / len(ns), 0.5)
        for v, co in moved.items():
            v.co = co
    bm.normal_update()
    open_edges = sum(1 for f in patch if f.is_valid for e in f.edges if e.is_boundary)
    log('neutral groin surface:', len(region), 'faces replaced by', len(patch), 'in', len(loops), 'patch(es), border loops of',
        [len(lp) for lp in loops], 'vertices,', len(extra), 'opening(s) between them filled,', len(area), 'vertices blended,',
        open_edges, 'open edges left')


def join_structure(st):
    bm = bmesh.new()
    names = []
    is_skin = st['tissue'] == 'skin'
    layer = bm.faces.layers.int.new('neutral') if is_skin else None
    for obj in sorted(st['objects'], key=lambda o: o.name):
        try:
            added = append_world_mesh(bm, obj)
        except Exception as e:  # noqa
            log('WARN cannot evaluate', obj.name, e)
            continue
        if added:
            names.append(obj.name)
            if is_skin and NEUTRAL_SKIN.search(obj.name):
                bm.faces.ensure_lookup_table()
                for f in bm.faces[len(bm.faces) - added:]:
                    f[layer] = 1
                neutral_skin_objects.append(obj.name)
    weld = 3e-4 if is_skin else 2e-5
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=weld)
    loose = [v for v in bm.verts if not v.link_faces]
    if loose:
        bmesh.ops.delete(bm, geom=loose, context='VERTS')
    if is_skin:
        neutralize_groin(bm, layer)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    for e in bm.edges:
        e.smooth = True  # no sharp edges: one smooth normal per vertex, no vertex splits on export
    me = bpy.data.meshes.new(st['id'])
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(st['id'], me)
    out_coll.objects.link(ob)
    st['out'] = ob
    st['sourceObjects'] = names
    st['raw_tris'] = len(me.polygons)
    return ob


t1 = time.time()
for i, st in enumerate(structures.values()):
    join_structure(st)
    if i % 25 == 0:
        log('joined', i, '/', len(structures), st['id'], st['raw_tris'], round(time.time() - t1, 1), 's')
empty = [s['id'] for s in structures.values() if s['raw_tris'] == 0]
for sid in empty:
    log('WARN empty structure dropped', sid)
    bpy.data.objects.remove(structures[sid]['out'])
    del structures[sid]

# the source objects are no longer needed: a small dependency graph makes decimation fast
scene.collection.children.unlink(src_coll)

# ---------------------------------------------------------------------------------------------
# 3. Triangle budgets: water filling with weight * raw^0.6 per structure inside each system
# ---------------------------------------------------------------------------------------------
MIN_TRIS = 260


def allocate(items, budget):
    """items: list of (key, raw, weight). Returns {key: target}."""
    target = {}
    free = list(items)
    remaining = float(budget)
    while free:
        total_w = sum(w * (raw ** 0.6) for _, raw, w in free)
        capped = []
        for key, raw, w in free:
            share = remaining * w * (raw ** 0.6) / total_w
            if share >= raw:
                capped.append((key, raw, w))
        if not capped:
            for key, raw, w in free:
                target[key] = max(min(raw, MIN_TRIS), int(remaining * w * (raw ** 0.6) / total_w))
            break
        for key, raw, w in capped:
            target[key] = raw
            remaining -= raw
        free = [it for it in free if it not in capped]
    return target


def blend_seam_normals(me, radius):
    """The skin is built from separate region patches whose borders do not always share vertices.
    Border vertices that sit within `radius` of each other get one averaged normal, so the
    seams between regions do not show as shading breaks."""
    from mathutils import kdtree
    me.update()
    edge_faces = {}
    for poly in me.polygons:
        for key in poly.edge_keys:
            edge_faces[key] = edge_faces.get(key, 0) + 1
    border = sorted({v for key, n in edge_faces.items() if n == 1 for v in key})
    normals = [v.normal.copy() for v in me.vertices]
    if border:
        tree = kdtree.KDTree(len(border))
        for i, vi in enumerate(border):
            tree.insert(me.vertices[vi].co, i)
        tree.balance()
        for vi in border:
            acc = Vector((0.0, 0.0, 0.0))
            for _, j, _ in tree.find_range(me.vertices[vi].co, radius):
                acc += me.vertices[border[j]].normal
            if acc.length > 1e-9:
                normals[vi] = acc.normalized()
    me.normals_split_custom_set_from_vertices(normals)
    log('skin seam normals blended on', len(border), 'border vertices')


targets = {}
for sysid, _, _ in SYSTEMS:
    members = [s for s in structures.values() if s['system'] == sysid]
    budget = SYSTEM_BUDGET[sysid]
    for s in members:
        if s['fixed']:
            targets[s['id']] = min(s['raw_tris'], int(s['fixed'] * OPTS['scale']))
            budget -= targets[s['id']]
    items = [(s['id'], s['raw_tris'], s['weight']) for s in members if not s['fixed']]
    if items:
        targets.update(allocate(items, max(budget, MIN_TRIS * len(items))))

view_layer.update()
t2 = time.time()
for i, st in enumerate(structures.values()):
    ob = st['out']
    tgt = targets[st['id']]
    if tgt < st['raw_tris'] * 0.97:
        mod = ob.modifiers.new('decimate', 'DECIMATE')
        mod.decimate_type = 'COLLAPSE'
        mod.ratio = max(0.01, tgt / st['raw_tris'])
        mod.use_collapse_triangulate = True
        view_layer.update()
        d = view_layer.depsgraph
        new = bpy.data.meshes.new_from_object(ob.evaluated_get(d), preserve_all_data_layers=False, depsgraph=d)
        ob.modifiers.clear()
        old = ob.data
        ob.data = new
        bpy.data.meshes.remove(old)
        new.name = st['id']
    me = ob.data
    me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    if st['tissue'] == 'skin':
        blend_seam_normals(me, 0.0012)
    me.materials.clear()
    me.materials.append(tissue_material(st['tissue']))
    me.update()
    st['tris'] = len(me.polygons)
    if i % 40 == 0:
        log('decimated', i, '/', len(structures), st['id'], st['raw_tris'], '->', st['tris'], round(time.time() - t2, 1), 's')

# ---------------------------------------------------------------------------------------------
# 4. Atlas frame: feet on z = 0 (Blender), centered on x and y, then the exporter turns Z up into Y up
# ---------------------------------------------------------------------------------------------
ref = structures.get('skin')
ref_objs = [ref['out']] if ref else [s['out'] for s in structures.values()]
mn = Vector((1e9, 1e9, 1e9)); mx = Vector((-1e9, -1e9, -1e9))
for ob in ref_objs:
    for v in ob.data.vertices:
        for k in range(3):
            mn[k] = min(mn[k], v.co[k]); mx[k] = max(mx[k], v.co[k])
if not ref:
    offset = Vector((0.0, 0.0, 0.0))
    frame_note = 'partial run: no skin, frame offset not applied'
else:
    offset = Vector((-(mn.x + mx.x) / 2.0, -(mn.y + mx.y) / 2.0, -mn.z))
    frame_note = 'offset from skin bounds'
log('frame', frame_note, [round(v, 5) for v in offset], 'skin min', [round(v, 4) for v in mn], 'max', [round(v, 4) for v in mx])
T = Matrix.Translation(offset)
for st in structures.values():
    st['out'].data.transform(T)
    st['out'].data.update()


def to_atlas(v):
    """Blender (x, y, z) after the offset -> atlas/glTF (x, z, -y)."""
    return [round(v[0], 5), round(v[2], 5), round(-v[1], 5)]


kidney_meta = {}
for side, (bmin, bmax) in kidney_boxes.items():
    a = Vector(bmin) + offset; b = Vector(bmax) + offset
    p, q = to_atlas(a), to_atlas(b)
    kidney_meta['left' if side == 'L' else 'right'] = {
        'min': [min(p[i], q[i]) for i in range(3)], 'max': [max(p[i], q[i]) for i in range(3)]}

# ---------------------------------------------------------------------------------------------
# 5. Export one GLB per system
# ---------------------------------------------------------------------------------------------
view_layer.update()
files = {}
for sysid, label, _ in SYSTEMS:
    members = [s for s in structures.values() if s['system'] == sysid]
    if not members:
        continue
    for ob in view_layer.objects:
        ob.select_set(False)
    for s in members:
        s['out'].select_set(True)
    view_layer.objects.active = members[0]['out']
    path = os.path.join(OUT_DIR, sysid + '.glb')
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=True, export_apply=False, export_yup=True,
        export_texcoords=False, export_normals=True, export_tangents=False, export_materials='EXPORT',
        export_vertex_color='NONE', export_attributes=False, export_cameras=False, export_lights=False,
        export_animations=False, export_skins=False, export_morph=False, export_extras=False)
    files[sysid] = {'file': sysid + '.glb', 'structures': len(members), 'triangles': sum(s['tris'] for s in members)}
    log('exported', sysid, len(members), 'structures', files[sysid]['triangles'], 'tris')

meta = {
    'blender': bpy.app.version_string,
    'sourceBlend': os.path.basename(bpy.data.filepath),
    'frame': {'offsetBlender': [round(v, 6) for v in offset], 'note': frame_note},
    'systems': [{'id': sid, 'label': label, **files[sid]} for sid, label, _ in SYSTEMS if sid in files],
    'structures': [
        {'id': s['id'], 'name': s['name'], 'system': s['system'], 'tissue': s['tissue'], 'side': s['side'],
         'parent': s['parent'], 'origin': 'z-anatomy', 'sourceObjects': s['sourceObjects'],
         'rawTriangles': s['raw_tris'], 'triangles': s['tris']}
        for s in sorted(structures.values(), key=lambda s: (s['system'], s['id']))],
    'kidneyBoxes': kidney_meta,
    'excludedObjects': {k: sorted(v) for k, v in excluded.items()},
    'neutralSkinObjects': sorted(neutral_skin_objects),
    'unmatched': [u[1] for u in unmatched],
}
with open(os.path.join(OUT_DIR, 'atlas-meta.json'), 'w', encoding='utf-8') as f:
    json.dump(meta, f, indent=1)
log('done', len(structures), 'structures', sum(s['tris'] for s in structures.values()), 'tris', round(time.time() - T0, 1), 's')
