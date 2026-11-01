/**
 * Illustrative unit plans for the RBU V-Sem AIML template courses. They are used until a faculty
 * member saves their own units from the Syllabus Progress view. Planned counts are in periods
 * (a 2-period lab session counts as 2).
 */

const units = (prefix, list) =>
  list.map(([title, planned_lectures], i) => ({ id: `${prefix}-u${i + 1}`, title, planned_lectures }))

const TEMPLATES = {
  'Machine Learning (ML)': units('ml', [
    ['Introduction & data preprocessing', 8],
    ['Supervised learning: regression & classification', 9],
    ['Model evaluation & ensemble methods', 8],
    ['Unsupervised learning & dimensionality reduction', 9],
    ['Neural network fundamentals', 8],
  ]),
  'Cloud & Edge Computing for AI (C&EC)': units('cec', [
    ['Cloud fundamentals & service models', 8],
    ['Virtualisation & containers', 8],
    ['Cloud AI services & MLOps pipelines', 9],
    ['Edge computing architectures', 8],
    ['Deploying & optimising models at the edge', 9],
  ]),
  'Computer Networks (CN)': units('cn', [
    ['Network models: OSI & TCP/IP', 8],
    ['Physical & data link layer', 9],
    ['Network layer & routing', 9],
    ['Transport layer: TCP & UDP', 8],
    ['Application layer & network security', 8],
  ]),
  'PDA (Programming for Data Science)': units('pda', [
    ['Python for data science', 8],
    ['NumPy & pandas', 9],
    ['Data wrangling & cleaning', 8],
    ['Exploratory analysis & visualisation', 9],
    ['Statistical inference basics', 8],
  ]),
  'IP (Image Processing Generative Models)': units('ip', [
    ['Digital image fundamentals', 8],
    ['Spatial & frequency domain filtering', 9],
    ['Segmentation & feature extraction', 8],
    ['Autoencoders & variational autoencoders', 8],
    ['GANs & diffusion models', 9],
  ]),
  'Open Elective-III (OE)': units('oe', [
    ['Module 1: Foundations', 6],
    ['Module 2: Core concepts', 6],
    ['Module 3: Applications', 6],
  ]),
  'MDM-II': units('mdm', [
    ['Module 1: Foundations', 9],
    ['Module 2: Methods', 9],
    ['Module 3: Tools & techniques', 9],
    ['Module 4: Case studies', 9],
    ['Module 5: Project review', 6],
  ]),
  'Idea Lab': units('idea', [
    ['Problem identification & ideation', 8],
    ['Design thinking & low-fidelity prototypes', 10],
    ['Build, test & iterate', 10],
    ['Demo & documentation', 8],
  ]),
  'CN Lab': units('cnlab', [
    ['Network commands & cabling', 4],
    ['Socket programming', 8],
    ['Routing protocol simulation', 8],
    ['Packet capture & analysis', 8],
    ['Mini project', 8],
  ]),
  'C&EC Lab': units('ceclab', [
    ['Provisioning cloud VMs & storage', 8],
    ['Containerising an ML service', 8],
    ['Serverless inference endpoint', 8],
    ['Edge deployment on a constrained device', 8],
    ['Mini project', 4],
  ]),
  'ML Lab': units('mllab', [
    ['Data preprocessing pipelines', 6],
    ['Regression & classification models', 8],
    ['Model evaluation & tuning', 8],
    ['Clustering & PCA', 6],
    ['Neural network from scratch', 8],
  ]),
  'DAV Lab': units('davlab', [
    ['Data loading & cleaning', 6],
    ['Descriptive statistics', 8],
    ['Visualisation with matplotlib & seaborn', 8],
    ['Interactive dashboards', 8],
    ['Mini project', 6],
  ]),
}

/** Template units for a catalog course name, or null. Batch labs ("CN Lab (Batch 1)") share one template. */
export function templateSyllabusFor(courseName = '') {
  const family = courseName.replace(/\s*\(Batch \d+\)\s*$/i, '').trim()
  const template = TEMPLATES[family]
  return template ? template.map((u) => ({ ...u })) : null
}
