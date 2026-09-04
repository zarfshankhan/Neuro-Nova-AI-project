import "./style.css";
import { IC } from "./icons";

const API = "/api";

/* ── Auth + Report state ──────────────────────────────── */
interface User { name: string; email: string; role: "doctor" | "patient"; }
interface Report {
  id: string; patientName: string; patientEmail: string;
  date: string; model: string; result: any;
  status: "pending" | "approved" | "rejected"; doctorNote: string;
}
let currentUser: User | null = null;
let selectedModel = "segresnet";
let growthPoints: { vol: number; day: number }[] = [];
const uploadedFiles: Record<string, File | null> = { t1: null, t1ce: null, t2: null, flair: null };
const ptFiles: Record<string, File | null>       = { t1: null, t1ce: null, t2: null, flair: null };
const reportStore: Report[] = [];

/* ── Bootstrap ────────────────────────────────────────── */
renderRoot();
spawnParticles();
function renderRoot() { currentUser ? showApp() : showAuth("login"); }

/* ══════════════════════════════════════════════
   AUTH
══════════════════════════════════════════════ */
function showAuth(mode: "login" | "signup") {
  document.querySelector<HTMLDivElement>("#app")!.innerHTML = buildAuth(mode);
}
(window as any).showAuth = (m: string) => showAuth(m as any);

let selectedRole: "doctor" | "patient" = "doctor";
(window as any).selectRole = (role: string, el: HTMLElement) => {
  selectedRole = role as any;
  document.querySelectorAll(".role-btn").forEach(b => b.classList.remove("active"));
  el.classList.add("active");
};
(window as any).demoLogin = (role: "doctor" | "patient") => {
  currentUser = { name: role === "doctor" ? "Dr. Demo" : "Patient Demo", email: role + "@demo.com", role };
  showApp();
};
(window as any).handleAuthSubmit = (e: Event) => {
  e.preventDefault();
  const err   = document.getElementById("auth-error")!;
  err.classList.remove("show");
  const email = (document.getElementById("auth-email") as HTMLInputElement).value;
  const pass  = (document.getElementById("auth-pass")  as HTMLInputElement).value;
  const name  = (document.getElementById("auth-name")  as HTMLInputElement | null)?.value;
  const pass2 = (document.getElementById("auth-pass2") as HTMLInputElement | null)?.value;
  const btn   = document.getElementById("auth-submit-btn") as HTMLButtonElement;
  if (!email || !pass) { err.textContent = "⚠ Fill all fields."; err.classList.add("show"); return; }
  if (pass.length < 6) { err.textContent = "⚠ Password min 6 chars."; err.classList.add("show"); return; }
  if (pass2 !== undefined && pass !== pass2) { err.textContent = "⚠ Passwords do not match."; err.classList.add("show"); return; }
  btn.disabled = true; btn.textContent = "Please wait…";
  setTimeout(() => { currentUser = { name: name || email.split("@")[0], email, role: selectedRole }; showApp(); }, 700);
};

function buildAuth(mode: "login" | "signup"): string {
  const isL = mode === "login";
  return `<div class="auth-root">
  <div class="auth-bg-orb auth-bg-orb-1"></div><div class="auth-bg-orb auth-bg-orb-2"></div><div class="auth-bg-orb auth-bg-orb-3"></div>
  <div class="auth-card">
    <div class="auth-logo"><div class="auth-logo-icon">${IC.brain}</div><span class="auth-logo-name">Neuro <span>Nova</span> AI</span></div>
    <div class="auth-title">${isL ? "Welcome back" : "Create account"}</div>
    <div class="auth-sub">${isL ? "Sign in to access the brain tumor analysis platform" : "Select your role to get started"}</div>
    <div class="role-selector">
      <div class="role-btn active" data-role="doctor" onclick="selectRole('doctor',this)">
        <span class="role-icon-wrap">${IC.stethoscope}</span>
        <span class="role-label">Doctor</span><span class="role-desc">Analyse &amp; approve reports</span>
      </div>
      <div class="role-btn" data-role="patient" onclick="selectRole('patient',this)">
        <span class="role-icon-wrap">${IC.user}</span>
        <span class="role-label">Patient</span><span class="role-desc">Upload scans &amp; view reports</span>
      </div>
    </div>
    <div class="auth-error" id="auth-error"></div>
    <form class="auth-form" onsubmit="handleAuthSubmit(event)">
      ${!isL ? `<div class="auth-field"><label class="auth-label">Full Name</label><input class="auth-input" id="auth-name" type="text" placeholder="e.g. Dr. Sarah Ahmed" required/></div>` : ""}
      <div class="auth-field"><label class="auth-label">Email</label><input class="auth-input" id="auth-email" type="email" placeholder="you@hospital.com" required/></div>
      <div class="auth-field"><label class="auth-label">Password</label><input class="auth-input" id="auth-pass" type="password" placeholder="${isL ? "Your password" : "Min. 6 characters"}" required/></div>
      ${!isL ? `<div class="auth-field"><label class="auth-label">Confirm Password</label><input class="auth-input" id="auth-pass2" type="password" placeholder="Repeat password" required/></div>` : ""}
      <button class="auth-btn" type="submit" id="auth-submit-btn">${isL ? "Sign in" : "Create account"}</button>
    </form>
    <div class="auth-divider"><div class="auth-divider-line"></div><span class="auth-divider-text">quick demo</span><div class="auth-divider-line"></div></div>
    <div style="display:flex;gap:10px;margin-bottom:14px">
      <button class="btn btn-secondary" style="flex:1;justify-content:center;gap:8px" onclick="demoLogin('doctor')">${IC.stethoscope} Demo Doctor</button>
      <button class="btn btn-secondary" style="flex:1;justify-content:center;gap:8px" onclick="demoLogin('patient')">${IC.user} Demo Patient</button>
    </div>
    <div class="auth-switch">${isL ? `No account? <a onclick="showAuth('signup')">Sign up</a>` : `Have an account? <a onclick="showAuth('login')">Sign in</a>`}</div>
  </div></div>`;
}

/* ══════════════════════════════════════════════
   SHELL
══════════════════════════════════════════════ */
function showApp() {
  document.querySelector<HTMLDivElement>("#app")!.innerHTML = buildShell();
  bindNav();
  if (currentUser!.role === "doctor") fetchDashboard();
}

function buildShell(): string {
  const u = currentUser!;
  const initials = u.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const isDoc = u.role === "doctor";
  const pendingCount = reportStore.filter(r => r.status === "pending").length;

  const docSidebar = `
    <div class="sidebar-label">Overview</div>
    <button class="nav-item active" data-page="dashboard">${IC.dashboard}<span>Dashboard</span></button>
    <div class="sidebar-label">Modules</div>
    <button class="nav-item" data-page="detection">${IC.target}<span>Tumor Detection</span></button>
    <button class="nav-item" data-page="xai">${IC.eye}<span>Explainable AI</span></button>
    <button class="nav-item" data-page="reports">${IC.fileText}<span>Report Generation</span></button>
    <button class="nav-item" data-page="privacy">${IC.shield}<span>Privacy &amp; Security</span></button>
    <button class="nav-item" data-page="research">${IC.bookOpen}<span>Research Support</span></button>
    <button class="nav-item" data-page="performance">${IC.zap}<span>Performance</span></button>
    <div class="sidebar-label">Tools</div>
    <button class="nav-item" data-page="models">${IC.cpu}<span>Models</span></button>
    <button class="nav-item" data-page="segment">${IC.scan}<span>Segmentation</span></button>
    <button class="nav-item" data-page="growth">${IC.trendUp}<span>Growth Predictor</span></button>
    <button class="nav-item" data-page="review">${IC.inbox}<span>Review Reports${pendingCount ? `<span class="nav-badge">${pendingCount}</span>` : ""}</span></button>
    <div class="sidebar-label">Dev</div>
    <button class="nav-item" data-page="api">${IC.api}<span>API Explorer</span></button>`;

  const patSidebar = `
    <div class="sidebar-label">My Portal</div>
    <button class="nav-item active" data-page="pt-home">${IC.home}<span>My Dashboard</span></button>
    <button class="nav-item" data-page="pt-upload">${IC.upload}<span>Upload Scan</span></button>
    <button class="nav-item" data-page="pt-reports">${IC.fileText}<span>My Reports</span></button>
    <div class="sidebar-label">Info</div>
    <button class="nav-item" data-page="privacy">${IC.shield}<span>Privacy &amp; Security</span></button>
    <button class="nav-item" data-page="research">${IC.bookOpen}<span>Education</span></button>`;

  return `
  <nav class="navbar">
    <div class="navbar-brand">
      <div class="brand-logo">${IC.brain}</div>
      <span class="brand-name">Neuro <span>Nova</span> AI</span>
      <span class="brand-badge">BETA</span>
    </div>
    <div class="nav-right">
      <div class="user-badge">
        <div class="user-avatar">${initials}</div>
        <div><div class="user-name">${u.name}</div></div>
        <span class="user-role ${u.role}">${isDoc ? IC.stethoscope + " Doctor" : IC.user + " Patient"}</span>
        <button class="icon-btn" onclick="logout()" title="Sign out">${IC.logout}</button>
      </div>
    </div>
  </nav>
  <div class="main-content">
    <aside class="sidebar">${isDoc ? docSidebar : patSidebar}</aside>
    <div class="page-wrap">${isDoc ? buildDoctorPages() : buildPatientPages()}</div>
  </div>
  <div class="toast-container" id="toasts"></div>`;
}

/* ══════════════════════════════════════════════
   BRAIN SVG (shared)
══════════════════════════════════════════════ */
function brainSVG(): string {
  return `<svg viewBox="0 0 200 200" width="200" height="200" style="filter:drop-shadow(0 20px 40px rgba(0,0,0,0.3))">
    <defs>
      <radialGradient id="bg2" cx="50%" cy="40%"><stop offset="0%" stop-color="rgba(255,255,255,0.9)"/><stop offset="100%" stop-color="rgba(255,255,255,0.2)"/></radialGradient>
      <filter id="glow2"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <ellipse cx="100" cy="100" rx="88" ry="28" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1.5" style="animation:orbitR 4s linear infinite"/>
    <ellipse cx="100" cy="100" rx="68" ry="20" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1" transform="rotate(60,100,100)" style="animation:orbitR 6s linear infinite reverse"/>
    <path d="M100 30 C60 30 35 55 35 80 C35 95 42 108 55 115 C50 125 52 140 65 145 C70 158 85 162 100 162 C115 162 130 158 135 145 C148 140 150 125 145 115 C158 108 165 95 165 80 C165 55 140 30 100 30Z" fill="url(#bg2)" filter="url(#glow2)" style="animation:bFloat 4s ease-in-out infinite"/>
    <path d="M70 75 C80 65 90 70 100 65 C110 60 120 68 130 75" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2" stroke-linecap="round"/>
    <path d="M60 95 C75 85 88 92 100 88 C112 84 125 90 140 95" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.5" stroke-linecap="round"/>
    <circle cx="80" cy="85" r="4" fill="rgba(255,255,255,0.8)" style="animation:nP 2s ease-in-out infinite"/>
    <circle cx="120" cy="90" r="3" fill="rgba(255,255,255,0.7)" style="animation:nP 2.5s ease-in-out infinite 0.3s"/>
    <circle cx="100" cy="110" r="3.5" fill="rgba(255,255,255,0.75)" style="animation:nP 3s ease-in-out infinite 0.6s"/>
    <line x1="80" y1="85" x2="120" y2="90" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
    <line x1="120" y1="90" x2="100" y2="110" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
    <line x1="100" y1="110" x2="80" y2="85" stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
    <style>@keyframes bFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}@keyframes nP{0%,100%{opacity:.8}50%{opacity:1}}@keyframes orbitR{from{transform:rotateZ(0)}to{transform:rotateZ(360deg)}}</style>
  </svg>`;
}

/* ══════════════════════════════════════════════
   DOCTOR PAGES
══════════════════════════════════════════════ */
function buildDoctorPages(): string {
  return pageDashboard() + pageDetection() + pageXAI() + pageReportsInfo()
       + pagePrivacy() + pageResearch() + pagePerformance()
       + pageModels() + pageSegment() + pageGrowth() + pageReview() + pageAPI();
}

function pageDashboard(): string { return `
<section class="page active" id="page-dashboard">
  <div class="hero-banner">
    <div class="hero-orb hero-orb-1"></div><div class="hero-orb hero-orb-2"></div>
    <div class="hero-content">
      <div class="hero-tag">AI-Powered Medical Imaging</div>
      <div class="hero-title">Brain Tumor Segmentation<br/>&amp; Analysis Platform</div>
      <div class="hero-sub">State-of-the-art deep learning for 3D MRI analysis with 7 integrated clinical modules.</div>
      <div class="hero-stats">
        <div class="hero-stat"><div class="hero-stat-val">88.96%</div><div class="hero-stat-label">Best Dice Score</div></div>
        <div class="hero-stat"><div class="hero-stat-val">8</div><div class="hero-stat-label">Architectures</div></div>
        <div class="hero-stat"><div class="hero-stat-val">7</div><div class="hero-stat-label">Modules</div></div>
        <div class="hero-stat"><div class="hero-stat-val">1,251</div><div class="hero-stat-label">Cases</div></div>
      </div>
    </div>
    <div class="hero-illustration">${brainSVG()}</div>
  </div>
  <div class="card">
    <div class="card-title"><div class="card-title-icon" style="background:var(--blue-light);color:var(--blue)">${IC.layers}</div>Platform Modules</div>
    <div class="feature-grid">
      <div class="feature-card blue" onclick="navTo('detection')" style="cursor:pointer"><div class="feature-icon">${IC.target}</div><div class="feature-title">Accurate Tumor Detection</div><div class="feature-desc">Multi-class 3D segmentation of ET, TC and WT regions using SOTA architectures.</div><span class="feature-tag">Active</span></div>
      <div class="feature-card purple" onclick="navTo('xai')" style="cursor:pointer"><div class="feature-icon">${IC.eye}</div><div class="feature-title">Explainable AI Integration</div><div class="feature-desc">GradCAM &amp; SHAP heatmaps reveal which voxels drive each prediction.</div><span class="feature-tag">Active</span></div>
      <div class="feature-card green" onclick="navTo('reports')" style="cursor:pointer"><div class="feature-icon">${IC.fileText}</div><div class="feature-title">Automated Report Generation</div><div class="feature-desc">Structured clinical reports with doctor approval workflow before delivery to patient.</div><span class="feature-tag">Active</span></div>
      <div class="feature-card red" onclick="navTo('privacy')" style="cursor:pointer"><div class="feature-icon">${IC.shield}</div><div class="feature-title">Data Privacy &amp; Security</div><div class="feature-desc">HIPAA-aligned, AES-256 encrypted, role-based access control.</div><span class="feature-tag">Active</span></div>
      <div class="feature-card amber" onclick="navTo('research')" style="cursor:pointer"><div class="feature-icon">${IC.bookOpen}</div><div class="feature-title">Educational &amp; Research Support</div><div class="feature-desc">Dataset explorer, literature links, model benchmarking tools.</div><span class="feature-tag">Active</span></div>
      <div class="feature-card cyan" onclick="navTo('performance')" style="cursor:pointer"><div class="feature-icon">${IC.zap}</div><div class="feature-title">High Performance &amp; Reliability</div><div class="feature-desc">GPU-accelerated inference, 99.9% uptime SLA, auto-scaling backend.</div><span class="feature-tag">Active</span></div>
    </div>
  </div>
  <div class="stats-grid">
    <div class="stat-card blue"><div class="stat-icon">${IC.activity}</div><div class="stat-label">Total Cases</div><div class="stat-value">1,251</div><div class="stat-sub">BraTS 2023 dataset</div></div>
    <div class="stat-card green"><div class="stat-icon">${IC.target}</div><div class="stat-label">Best Dice</div><div class="stat-value">88.96%</div><div class="stat-sub">SegResNet model</div></div>
    <div class="stat-card purple"><div class="stat-icon">${IC.cpu}</div><div class="stat-label">Architectures</div><div class="stat-value">8</div><div class="stat-sub">SOTA models</div></div>
    <div class="stat-card amber"><div class="stat-icon">${IC.layers}</div><div class="stat-label">Modalities</div><div class="stat-value">4</div><div class="stat-sub">T1·T1ce·T2·FLAIR</div></div>
  </div>
  <div class="card">
    <div class="card-title"><div class="card-title-icon" style="background:var(--blue-light);color:var(--blue)">${IC.activity}</div>Model Performance</div>
    <div id="perf-table"><div class="loader-wrap"><div class="spinner-wrap"><div class="spinner-ring"></div><div class="spinner-ring"></div><div class="spinner-ring"></div></div></div></div>
  </div>
</section>`; }

function pageDetection(): string { return `
<section class="page" id="page-detection">
  <div class="page-header">
    <div class="page-title"><div class="page-title-icon">${IC.target}</div>Accurate Tumor Detection</div>
    <div class="page-subtitle">Multi-class 3D brain tumor segmentation across four MRI modalities</div>
  </div>
  <div class="feature-grid">
    <div class="feature-card blue"><div class="feature-icon">${IC.brain}</div><div class="feature-title">3D Volumetric Segmentation</div><div class="feature-desc">Full 3D analysis preserving spatial context across all MRI slices for superior accuracy.</div><span class="feature-tag">Core</span></div>
    <div class="feature-card purple"><div class="feature-icon">${IC.scan}</div><div class="feature-title">Multi-class Labels</div><div class="feature-desc">Simultaneous detection of Enhancing Tumor (ET), Tumor Core (TC), and Whole Tumor (WT).</div><span class="feature-tag">3 Classes</span></div>
    <div class="feature-card green"><div class="feature-icon">${IC.layers}</div><div class="feature-title">4-Modality Fusion</div><div class="feature-desc">T1, T1ce, T2, and FLAIR modalities fused for complete tumour characterisation.</div><span class="feature-tag">Multi-modal</span></div>
    <div class="feature-card amber"><div class="feature-icon">${IC.zap}</div><div class="feature-title">Real-time Inference</div><div class="feature-desc">GPU-accelerated sliding-window inference delivers results in seconds.</div><span class="feature-tag">Fast</span></div>
  </div>
  <div class="card">
    <div class="card-title"><div class="card-title-icon" style="background:var(--blue-light);color:var(--blue)">${IC.cpu}</div>Supported Architectures</div>
    <div id="detection-model-list"><div class="loader-wrap"><div class="spinner-wrap"><div class="spinner-ring"></div><div class="spinner-ring"></div><div class="spinner-ring"></div></div></div></div>
  </div>
  <div class="card">
    <div class="card-title"><div class="card-title-icon" style="background:var(--green-light);color:var(--green)">${IC.checkCircle}</div>Tumour Region Targets</div>
    <ul class="info-list">
      <li><span class="bullet">ET</span><strong>Enhancing Tumor</strong> — Active tumour cells on T1-contrast. Highest clinical priority.</li>
      <li><span class="bullet">TC</span><strong>Tumor Core</strong> — ET + necrotic core. Central disease burden.</li>
      <li><span class="bullet">WT</span><strong>Whole Tumor</strong> — TC + peritumoral edema. Total affected region.</li>
    </ul>
  </div>
  <div style="text-align:center;margin-top:8px"><button class="btn btn-primary" onclick="navTo('segment')">${IC.scan} Run Segmentation</button></div>
</section>`; }

function pageXAI(): string { return `
<section class="page" id="page-xai">
  <div class="page-header">
    <div class="page-title"><div class="page-title-icon">${IC.eye}</div>Explainable AI Integration</div>
    <div class="page-subtitle">Transparent model decisions with GradCAM attention maps and SHAP feature importance</div>
  </div>
  <div class="feature-grid">
    <div class="feature-card blue"><div class="feature-icon">${IC.eye}</div><div class="feature-title">GradCAM Heatmaps</div><div class="feature-desc">Class Activation Maps highlight which brain regions most influenced the prediction.</div><span class="feature-tag">Visual</span></div>
    <div class="feature-card purple"><div class="feature-icon">${IC.activity}</div><div class="feature-title">SHAP Analysis</div><div class="feature-desc">SHapley Additive exPlanations quantify each voxel's contribution to the output.</div><span class="feature-tag">Quantitative</span></div>
    <div class="feature-card green"><div class="feature-icon">${IC.checkCircle}</div><div class="feature-title">Clinical Trust</div><div class="feature-desc">Explanation overlays help radiologists validate AI decisions before clinical action.</div><span class="feature-tag">Trust</span></div>
    <div class="feature-card amber"><div class="feature-icon">${IC.fileText}</div><div class="feature-title">Audit Trail</div><div class="feature-desc">Every prediction is logged with its explanation map for regulatory compliance.</div><span class="feature-tag">Compliance</span></div>
  </div>
  <div class="card">
    <div class="card-title"><div class="card-title-icon" style="background:var(--purple-light);color:var(--purple)">${IC.eye}</div>Sample Heatmap Demo</div>
    <div class="xai-demo">
      <svg class="xai-brain-svg" viewBox="0 0 180 180">
        <defs>
          <radialGradient id="hm1" cx="45%" cy="42%"><stop offset="0%" stop-color="#ef4444"/><stop offset="35%" stop-color="#f97316"/><stop offset="65%" stop-color="#eab308"/><stop offset="100%" stop-color="transparent"/></radialGradient>
          <radialGradient id="hm2" cx="60%" cy="55%"><stop offset="0%" stop-color="#f97316" stop-opacity="0.7"/><stop offset="100%" stop-color="transparent"/></radialGradient>
        </defs>
        <path d="M90 22 C54 22 30 46 30 70 C30 84 37 96 49 103 C44 113 46 127 58 132 C63 144 77 148 90 148 C103 148 117 144 122 132 C134 127 136 113 131 103 C143 96 150 84 150 70 C150 46 126 22 90 22Z" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1.5"/>
        <path d="M90 22 C54 22 30 46 30 70 C30 84 37 96 49 103 C44 113 46 127 58 132 C63 144 77 148 90 148 C103 148 117 144 122 132 C134 127 136 113 131 103 C143 96 150 84 150 70 C150 46 126 22 90 22Z" fill="url(#hm1)" opacity="0.75"/>
        <path d="M90 22 C54 22 30 46 30 70 C30 84 37 96 49 103 C44 113 46 127 58 132 C63 144 77 148 90 148 C103 148 117 144 122 132 C134 127 136 113 131 103 C143 96 150 84 150 70 C150 46 126 22 90 22Z" fill="url(#hm2)" opacity="0.5"/>
        <circle cx="82" cy="78" r="10" fill="#ef4444" opacity="0.6" style="animation:nP 2s ease-in-out infinite"/>
        <circle cx="98" cy="82" r="7"  fill="#f97316" opacity="0.5" style="animation:nP 2.5s ease-in-out infinite 0.3s"/>
      </svg>
      <div style="font-size:12px;color:var(--text-3);margin-top:8px;font-weight:500">GradCAM overlay — red = highest model attention</div>
      <div class="heatmap-legend">
        <div class="heatmap-swatch" style="background:#3b82f6"></div><div class="heatmap-swatch" style="background:#22c55e"></div>
        <div class="heatmap-swatch" style="background:#eab308"></div><div class="heatmap-swatch" style="background:#f97316"></div>
        <div class="heatmap-swatch" style="background:#ef4444"></div>
      </div>
      <div class="heatmap-labels"><span>Low</span><span>Medium</span><span>High</span></div>
    </div>
  </div>
</section>`; }

function pageReportsInfo(): string { return `
<section class="page" id="page-reports">
  <div class="page-header">
    <div class="page-title"><div class="page-title-icon">${IC.fileText}</div>Automated Report Generation</div>
    <div class="page-subtitle">AI-generated reports sent to doctor for approval before reaching the patient</div>
  </div>
  <div class="feature-grid">
    <div class="feature-card green"><div class="feature-icon">${IC.fileText}</div><div class="feature-title">Structured Templates</div><div class="feature-desc">Standardised radiology format with patient info, findings, volumes, and recommendations.</div><span class="feature-tag">Templates</span></div>
    <div class="feature-card blue"><div class="feature-icon">${IC.activity}</div><div class="feature-title">Quantitative Metrics</div><div class="feature-desc">Dice scores, tumour volumes (cc), severity and growth trend automatically included.</div><span class="feature-tag">Metrics</span></div>
    <div class="feature-card purple"><div class="feature-icon">${IC.check}</div><div class="feature-title">Doctor Approval Workflow</div><div class="feature-desc">Every report requires a doctor to review, annotate, and approve before the patient sees it.</div><span class="feature-tag">Gated</span></div>
    <div class="feature-card amber"><div class="feature-icon">${IC.clock}</div><div class="feature-title">Report History</div><div class="feature-desc">All reports stored with timestamps, status, and doctor notes — accessible by role.</div><span class="feature-tag">History</span></div>
  </div>
  <div style="text-align:center;margin-top:4px">
    <button class="btn btn-primary" onclick="navTo('review')">${IC.inbox} Review Pending Reports</button>
  </div>
</section>`; }

function pagePrivacy(): string { return `
<section class="page" id="page-privacy">
  <div class="page-header">
    <div class="page-title"><div class="page-title-icon">${IC.shield}</div>Data Privacy &amp; Security</div>
    <div class="page-subtitle">HIPAA-aligned security protecting patient data at every layer</div>
  </div>
  <div class="feature-grid">
    <div class="feature-card red"><div class="feature-icon">${IC.lock}</div><div class="feature-title">AES-256 Encryption</div><div class="feature-desc">All patient data and MRI files encrypted at rest and in transit via TLS 1.3.</div><span class="feature-tag">Encryption</span></div>
    <div class="feature-card blue"><div class="feature-icon">${IC.shield}</div><div class="feature-title">Role-Based Access</div><div class="feature-desc">Doctors and patients have strictly separated permissions — patients see only their own records.</div><span class="feature-tag">RBAC</span></div>
    <div class="feature-card green"><div class="feature-icon">${IC.fileText}</div><div class="feature-title">Audit Logging</div><div class="feature-desc">Every access and inference logged with user, timestamp and action.</div><span class="feature-tag">Compliance</span></div>
    <div class="feature-card amber"><div class="feature-icon">${IC.trash}</div><div class="feature-title">Data Minimisation</div><div class="feature-desc">Uploaded MRI files deleted after inference. No raw patient data retained beyond session.</div><span class="feature-tag">Privacy</span></div>
  </div>
  <div class="card">
    <div class="card-title"><div class="card-title-icon" style="background:var(--green-light);color:var(--green)">${IC.checkCircle}</div>Compliance Checklist</div>
    ${["HIPAA-aligned data handling and access controls","GDPR Article 17 — right to erasure implemented","TLS 1.3 for all API communication","AES-256 encryption for data at rest","Role-based access — Doctor vs Patient separation","Temporary file purge after inference","Full audit trail for every platform action"].map(t => `<div class="privacy-check"><span class="privacy-check-icon">${IC.checkCircle}</span><span class="privacy-check-text">${t}</span></div>`).join("")}
  </div>
</section>`; }

function pageResearch(): string { return `
<section class="page" id="page-research">
  <div class="page-header">
    <div class="page-title"><div class="page-title-icon">${IC.bookOpen}</div>Educational &amp; Research Support</div>
    <div class="page-subtitle">Tools, datasets, and resources for medical AI researchers and educators</div>
  </div>
  <div class="tab-bar">
    <button class="tab-item active" onclick="switchTab(this,'research','overview')">Overview</button>
    <button class="tab-item" onclick="switchTab(this,'research','dataset')">Dataset</button>
    <button class="tab-item" onclick="switchTab(this,'research','models')">Model Comparison</button>
    <button class="tab-item" onclick="switchTab(this,'research','literature')">Literature</button>
  </div>
  <div class="tab-panel active" id="research-tab-overview">
    <div class="feature-grid">
      <div class="feature-card amber"><div class="feature-icon">${IC.bookOpen}</div><div class="feature-title">Educational Mode</div><div class="feature-desc">Step-by-step walkthroughs of the segmentation pipeline for medical AI students.</div><span class="feature-tag">Learning</span></div>
      <div class="feature-card blue"><div class="feature-icon">${IC.activity}</div><div class="feature-title">Dataset Explorer</div><div class="feature-desc">Browse BraTS 2023 statistics and modality examples interactively.</div><span class="feature-tag">Explore</span></div>
      <div class="feature-card purple"><div class="feature-icon">${IC.cpu}</div><div class="feature-title">Model Benchmarking</div><div class="feature-desc">Compare 8 architectures side-by-side on Dice ET/TC/WT and inference time.</div><span class="feature-tag">Compare</span></div>
      <div class="feature-card green"><div class="feature-icon">${IC.fileText}</div><div class="feature-title">Literature Links</div><div class="feature-desc">Curated reading list of key papers on brain tumour segmentation and XAI.</div><span class="feature-tag">Papers</span></div>
    </div>
  </div>
  <div class="tab-panel" id="research-tab-dataset">
    <div class="card" style="margin-top:0">
      <div class="card-title"><div class="card-title-icon" style="background:var(--amber-light);color:var(--amber)">${IC.layers}</div>BraTS 2023 Dataset</div>
      <div class="stats-grid" style="margin-bottom:0">
        <div class="stat-card blue"><div class="stat-icon">${IC.layers}</div><div class="stat-label">Total Cases</div><div class="stat-value">1,251</div></div>
        <div class="stat-card blue"><div class="stat-icon">${IC.bookOpen}</div><div class="stat-label">Training</div><div class="stat-value">833</div></div>
        <div class="stat-card purple"><div class="stat-icon">${IC.checkCircle}</div><div class="stat-label">Validation</div><div class="stat-value">209</div></div>
        <div class="stat-card green"><div class="stat-icon">${IC.target}</div><div class="stat-label">Test</div><div class="stat-value">209</div></div>
      </div>
    </div>
  </div>
  <div class="tab-panel" id="research-tab-models">
    <div class="card" style="margin-top:0">
      <div class="card-title"><div class="card-title-icon" style="background:var(--purple-light);color:var(--purple)">${IC.cpu}</div>Architecture Comparison</div>
      <div id="research-model-table">Loading…</div>
    </div>
  </div>
  <div class="tab-panel" id="research-tab-literature">
    <div class="card" style="margin-top:0">
      <div class="card-title"><div class="card-title-icon" style="background:var(--green-light);color:var(--green)">${IC.bookOpen}</div>Key References</div>
      <ul class="info-list">
        <li><span class="bullet">1</span><span><strong>BraTS 2023</strong> — Menze et al. IEEE TMI 2015.</span></li>
        <li><span class="bullet">2</span><span><strong>SegResNet</strong> — Myronenko A. MICCAI 2018.</span></li>
        <li><span class="bullet">3</span><span><strong>Attention U-Net</strong> — Oktay et al. MIDL 2018.</span></li>
        <li><span class="bullet">4</span><span><strong>MONAI</strong> — Project MONAI Consortium. arXiv 2020.</span></li>
        <li><span class="bullet">5</span><span><strong>GradCAM</strong> — Selvaraju et al. ICCV 2017.</span></li>
      </ul>
    </div>
  </div>
</section>`; }

function pagePerformance(): string { return `
<section class="page" id="page-performance">
  <div class="page-header">
    <div class="page-title"><div class="page-title-icon">${IC.zap}</div>High Performance &amp; Reliability</div>
    <div class="page-subtitle">GPU-accelerated inference, auto-scaling infrastructure, 99.9% uptime SLA</div>
  </div>
  <div class="perf-ring-grid" style="margin-bottom:24px">
    <div class="perf-ring-card">${IC.target}<div class="ring-val" style="color:var(--green)">88.96%</div><div class="ring-label">Best Dice Score</div></div>
    <div class="perf-ring-card">${IC.zap}<div class="ring-val" style="color:var(--blue)">~3s</div><div class="ring-label">Avg Inference</div></div>
    <div class="perf-ring-card">${IC.activity}<div class="ring-val" style="color:var(--purple)">99.9%</div><div class="ring-label">Uptime SLA</div></div>
    <div class="perf-ring-card">${IC.trendUp}<div class="ring-val" style="color:var(--amber)">8x</div><div class="ring-label">GPU Speedup</div></div>
    <div class="perf-ring-card">${IC.server}<div class="ring-val" style="color:var(--cyan)">4GB</div><div class="ring-label">VRAM Required</div></div>
  </div>
  <div class="feature-grid">
    <div class="feature-card blue"><div class="feature-icon">${IC.zap}</div><div class="feature-title">GPU Acceleration</div><div class="feature-desc">CUDA-optimised MONAI pipeline — 8× faster than CPU. Supports A100, V100, RTX.</div><span class="feature-tag">CUDA</span></div>
    <div class="feature-card green"><div class="feature-icon">${IC.layers}</div><div class="feature-title">Sliding Window Inference</div><div class="feature-desc">Memory-efficient patch-based inference handles full 240×240×155 volumes.</div><span class="feature-tag">Efficient</span></div>
    <div class="feature-card purple"><div class="feature-icon">${IC.server}</div><div class="feature-title">Auto-scaling API</div><div class="feature-desc">FastAPI backend scales horizontally via container orchestration. Zero downtime.</div><span class="feature-tag">Scalable</span></div>
    <div class="feature-card amber"><div class="feature-icon">${IC.activity}</div><div class="feature-title">Benchmarked</div><div class="feature-desc">SegResNet 88.96% Dice on BraTS 2023. AttentionUNet 87.23%.</div><span class="feature-tag">Verified</span></div>
  </div>
  <div class="card">
    <div class="card-title"><div class="card-title-icon" style="background:var(--blue-light);color:var(--blue)">${IC.activity}</div>Model Performance Table</div>
    <div id="perf-model-table"><div class="loader-wrap"><div class="spinner-wrap"><div class="spinner-ring"></div><div class="spinner-ring"></div><div class="spinner-ring"></div></div></div></div>
  </div>
</section>`; }

function pageModels(): string { return `
<section class="page" id="page-models">
  <div class="page-header">
    <div class="page-title"><div class="page-title-icon">${IC.cpu}</div>Models</div>
    <div class="page-subtitle">Select an architecture — used for segmentation inference</div>
  </div>
  <div class="model-grid" id="model-grid">
    <div class="loader-wrap"><div class="spinner-wrap"><div class="spinner-ring"></div><div class="spinner-ring"></div><div class="spinner-ring"></div></div><div class="loader-text">Loading models…</div></div>
  </div>
</section>`; }

function pageSegment(): string {
  const mods = ["t1","t1ce","t2","flair"];
  const labels: Record<string,string> = { t1:"T1", t1ce:"T1ce", t2:"T2", flair:"FLAIR" };
  const descs:  Record<string,string> = { t1:"Native T1", t1ce:"Contrast-enhanced T1", t2:"T2-weighted", flair:"T2 FLAIR" };
  return `
<section class="page" id="page-segment">
  <div class="page-header">
    <div class="page-title"><div class="page-title-icon">${IC.scan}</div>Segmentation</div>
    <div class="page-subtitle">Upload MRI NIfTI files and run brain tumor segmentation inference</div>
  </div>
  <div class="card">
    <div class="card-title"><div class="card-title-icon" style="background:var(--blue-light);color:var(--blue)">${IC.upload}</div>Upload MRI Modalities <span style="font-size:12px;font-weight:400;color:var(--text-4)">(.nii / .nii.gz)</span></div>
    <div class="upload-grid">
      ${mods.map(m => `<div class="upload-zone" id="zone-${m}"><input type="file" accept=".nii,.nii.gz" onchange="handleUpload(event,'${m}')"/><div class="upload-icon-wrap">${IC.upload}</div><div class="upload-label">${labels[m]}</div><div class="upload-sub">${descs[m]}</div><div class="upload-filename" id="fname-${m}"></div></div>`).join("")}
    </div>
    <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
      <button class="btn btn-primary" id="run-seg-btn" onclick="runSegmentation()">${IC.scan} Run Segmentation</button>
      <button class="btn btn-secondary" onclick="clearUploads()">${IC.close} Clear Files</button>
      <span style="font-size:13px;color:var(--text-3)">Model: <strong id="selected-model-label" style="color:var(--blue)">SegResNet</strong></span>
    </div>
  </div>
  <div id="seg-result"></div>
</section>`;
}

function pageGrowth(): string { return `
<section class="page" id="page-growth">
  <div class="page-header">
    <div class="page-title"><div class="page-title-icon">${IC.trendUp}</div>Growth Predictor</div>
    <div class="page-subtitle">LSTM-based tumor growth forecasting from historical volume measurements</div>
  </div>
  <div class="card">
    <div class="card-title"><div class="card-title-icon" style="background:var(--purple-light);color:var(--purple)">${IC.plus}</div>Historical Volume Data</div>
    <div class="input-row">
      <div class="input-group" style="flex:1"><label class="input-label">Volume (cc)</label><input class="tag-input" id="vol-input" type="number" placeholder="e.g. 12.5" step="0.1" min="0"/></div>
      <div class="input-group" style="flex:1"><label class="input-label">Day (from first scan)</label><input class="tag-input" id="day-input" type="number" placeholder="e.g. 0" min="0"/></div>
      <button class="add-btn" onclick="addGrowthPoint()">${IC.plus} Add</button>
    </div>
    <div class="datapoint-list" id="datapoint-list"><span style="font-size:12px;color:var(--text-4)">No data points yet</span></div>
    <div style="margin-top:20px;display:flex;gap:10px">
      <button class="btn btn-primary" onclick="runGrowthPrediction()">${IC.trendUp} Predict Growth</button>
      <button class="btn btn-secondary" onclick="clearGrowthPoints()">${IC.close} Clear</button>
    </div>
  </div>
  <div id="growth-result"></div>
</section>`; }

function pageReview(): string { return `
<section class="page" id="page-review">
  <div class="page-header">
    <div class="page-title"><div class="page-title-icon">${IC.inbox}</div>Review Reports</div>
    <div class="page-subtitle">Patient-submitted analysis results awaiting your clinical review and approval</div>
  </div>
  <div id="review-list">${renderReviewList()}</div>
</section>`; }

function pageAPI(): string {
  const eps = [
    { m:"GET",  p:"/health",         d:"Server health check & CUDA status" },
    { m:"GET",  p:"/models",         d:"List all available architectures" },
    { m:"GET",  p:"/dataset-stats",  d:"BraTS 2023 dataset statistics" },
    { m:"POST", p:"/segment",        d:"Run brain tumor segmentation" },
    { m:"POST", p:"/growth-predict", d:"Predict tumor growth trajectory" },
  ];
  return `
<section class="page" id="page-api">
  <div class="page-header">
    <div class="page-title"><div class="page-title-icon">${IC.api}</div>API Explorer</div>
    <div class="page-subtitle">FastAPI backend — <code style="background:var(--blue-light);color:var(--blue);padding:2px 8px;border-radius:5px;font-size:12px">/api/*</code></div>
  </div>
  <div class="card">
    <div class="card-title"><div class="card-title-icon" style="background:var(--blue-light);color:var(--blue)">${IC.server}</div>Endpoints</div>
    ${eps.map(e=>`<div class="api-row"><div style="display:flex;align-items:center"><span class="api-method ${e.m.toLowerCase()}">${e.m}</span><span class="api-endpoint">${e.p}</span></div><div style="display:flex;align-items:center;gap:16px"><span class="api-desc">${e.d}</span><button class="btn btn-secondary" style="padding:7px 14px;font-size:12px" onclick="testEndpoint('${e.m}','${e.p}')">Test</button></div></div>`).join("")}
  </div>
  <div class="card" id="api-response-card" style="display:none">
    <div class="card-title"><div class="card-title-icon" style="background:var(--green-light);color:var(--green)">${IC.checkCircle}</div>Response</div>
    <pre class="pre-wrap" id="api-response-body"></pre>
  </div>
</section>`;
}

/* ══════════════════════════════════════════════
   PATIENT PAGES
══════════════════════════════════════════════ */
function buildPatientPages(): string {
  return pagePatientHome() + pagePatientUpload() + pagePatientReports() + pagePrivacy() + pageResearch();
}

function pagePatientHome(): string { return `
<section class="page active" id="page-pt-home">
  <div class="hero-banner" style="background:linear-gradient(135deg,#1e3a8a 0%,#5b21b6 50%,#0e7490 100%)">
    <div class="hero-orb hero-orb-1"></div><div class="hero-orb hero-orb-2"></div>
    <div class="hero-content">
      <div class="hero-tag">Patient Portal</div>
      <div class="hero-title">Your MRI Analysis<br/>Dashboard</div>
      <div class="hero-sub">Upload your MRI scans, track analysis status, and view doctor-approved reports — all in one secure place.</div>
      <div style="display:flex;gap:12px;margin-top:24px;flex-wrap:wrap">
        <button class="btn" style="background:white;color:var(--blue);font-weight:700;padding:13px 28px;border-radius:12px;display:flex;align-items:center;gap:8px" onclick="navTo('pt-upload')">${IC.upload} Upload New Scan</button>
        <button class="btn" style="background:rgba(255,255,255,0.15);color:white;border:1px solid rgba(255,255,255,0.3);font-weight:600;padding:13px 28px;border-radius:12px;display:flex;align-items:center;gap:8px" onclick="navTo('pt-reports')">${IC.fileText} View My Reports</button>
      </div>
    </div>
    <div class="hero-illustration">${brainSVG()}</div>
  </div>
  <div class="stats-grid">
    <div class="stat-card blue"><div class="stat-icon">${IC.upload}</div><div class="stat-label">Scans Submitted</div><div class="stat-value" id="pt-stat-uploads">0</div><div class="stat-sub">All time</div></div>
    <div class="stat-card green"><div class="stat-icon">${IC.checkCircle}</div><div class="stat-label">Approved Reports</div><div class="stat-value" id="pt-stat-approved">0</div><div class="stat-sub">Ready to view</div></div>
    <div class="stat-card amber"><div class="stat-icon">${IC.clock}</div><div class="stat-label">Pending Review</div><div class="stat-value" id="pt-stat-pending">0</div><div class="stat-sub">Awaiting doctor</div></div>
  </div>
  <div class="card">
    <div class="card-title"><div class="card-title-icon" style="background:var(--blue-light);color:var(--blue)">${IC.clock}</div>Recent Activity</div>
    <div id="pt-recent">${renderPatientRecent()}</div>
  </div>
</section>`; }

function pagePatientUpload(): string {
  const mods = ["t1","t1ce","t2","flair"];
  const labels: Record<string,string> = { t1:"T1", t1ce:"T1ce", t2:"T2", flair:"FLAIR" };
  const descs:  Record<string,string> = { t1:"Native T1", t1ce:"Contrast-enhanced T1", t2:"T2-weighted", flair:"T2 FLAIR" };
  return `
<section class="page" id="page-pt-upload">
  <div class="page-header">
    <div class="page-title"><div class="page-title-icon">${IC.upload}</div>Upload MRI Scan</div>
    <div class="page-subtitle">Upload your NIfTI files — AI analyses them and submits to your doctor for review before you receive the report</div>
  </div>
  <div class="info-banner">
    ${IC.alertCircle}
    <span>Your scan will be <strong>analysed automatically</strong>. A doctor will review the AI results before you can see your report.</span>
  </div>
  <div class="card">
    <div class="card-title"><div class="card-title-icon" style="background:var(--blue-light);color:var(--blue)">${IC.upload}</div>Select MRI Modalities <span style="font-size:12px;font-weight:400;color:var(--text-4)">(.nii / .nii.gz)</span></div>
    <div class="upload-grid">
      ${mods.map(m=>`<div class="upload-zone" id="pt-zone-${m}"><input type="file" accept=".nii,.nii.gz" onchange="ptHandleUpload(event,'${m}')"/><div class="upload-icon-wrap">${IC.upload}</div><div class="upload-label">${labels[m]}</div><div class="upload-sub">${descs[m]}</div><div class="upload-filename" id="pt-fname-${m}"></div></div>`).join("")}
    </div>
    <button class="btn btn-primary" id="pt-submit-btn" onclick="patientSubmitScan()">${IC.upload} Submit for Analysis</button>
  </div>
  <div id="pt-submit-result"></div>
</section>`; }

function pagePatientReports(): string { return `
<section class="page" id="page-pt-reports">
  <div class="page-header">
    <div class="page-title"><div class="page-title-icon">${IC.fileText}</div>My Reports</div>
    <div class="page-subtitle">Doctor-approved reports only — pending reports appear once your doctor has reviewed them</div>
  </div>
  <div id="pt-reports-list">${renderPatientReports()}</div>
</section>`; }

/* ══════════════════════════════════════════════
   REVIEW HELPERS
══════════════════════════════════════════════ */
function renderReviewList(): string {
  if (!reportStore.length) return `<div class="empty-state"><div class="empty-icon">${IC.inbox}</div><div class="empty-title">No reports yet</div><div class="empty-sub">Patient-submitted results will appear here for your review.</div></div>`;
  return reportStore.map((r, idx) => {
    const sev = r.result.severity?.toLowerCase() ?? "low";
    const scls = sev==="high"?"sev-high":sev==="low"?"sev-low":"sev-moderate";
    const m = r.result.metrics ?? {};
    return `<div class="report-review-card" id="rrc-${idx}">
      <div class="rrc-header">
        <div style="display:flex;align-items:center;gap:12px">
          <div class="rrc-avatar">${r.patientName.split(" ").map((w:string)=>w[0]).join("").slice(0,2).toUpperCase()}</div>
          <div><div class="rrc-name">${r.patientName}</div><div class="rrc-meta">${r.date} · Model: ${r.model.toUpperCase()}</div></div>
        </div>
        <span class="status-pill ${r.status}">${r.status==="pending"?IC.clock:r.status==="approved"?IC.checkCircle:IC.close} ${r.status.charAt(0).toUpperCase()+r.status.slice(1)}</span>
      </div>
      <div class="rrc-metrics">
        <div class="rrc-metric"><span class="rrc-metric-label">ET Dice</span><span class="rrc-metric-val">${((m.dice_ET||0)*100).toFixed(1)}%</span></div>
        <div class="rrc-metric"><span class="rrc-metric-label">TC Dice</span><span class="rrc-metric-val">${((m.dice_TC||0)*100).toFixed(1)}%</span></div>
        <div class="rrc-metric"><span class="rrc-metric-label">WT Dice</span><span class="rrc-metric-val">${((m.dice_WT||0)*100).toFixed(1)}%</span></div>
        <div class="rrc-metric"><span class="rrc-metric-label">Severity</span><span class="severity-badge ${scls}" style="margin:0">${r.result.severity}</span></div>
      </div>
      ${r.status==="pending" ? `
      <div class="rrc-actions">
        <textarea class="auth-input" id="note-${idx}" placeholder="Add clinical note (optional)…" rows="2" style="resize:vertical;margin-bottom:10px;width:100%"></textarea>
        <div style="display:flex;gap:10px">
          <button class="btn btn-success" onclick="approveReport(${idx})">${IC.checkCircle} Approve &amp; Send to Patient</button>
          <button class="btn btn-danger"  onclick="rejectReport(${idx})">${IC.close} Reject</button>
        </div>
      </div>` : `<div class="rrc-note">${IC.fileText} <em>${r.doctorNote || "No note added."}</em></div>`}
    </div>`;
  }).join("");
}

(window as any).approveReport = (idx: number) => {
  const note = (document.getElementById("note-"+idx) as HTMLTextAreaElement)?.value || "";
  reportStore[idx].status = "approved"; reportStore[idx].doctorNote = note;
  refreshReview(); updateReviewBadge();
  toast("Report approved and sent to patient", "success");
};
(window as any).rejectReport = (idx: number) => {
  const note = (document.getElementById("note-"+idx) as HTMLTextAreaElement)?.value || "";
  reportStore[idx].status = "rejected"; reportStore[idx].doctorNote = note;
  refreshReview(); updateReviewBadge();
  toast("Report rejected", "info");
};
function refreshReview() { const el=document.getElementById("review-list"); if(el) el.innerHTML=renderReviewList(); }
function updateReviewBadge() {
  const b = document.getElementById("review-badge");
  const n = reportStore.filter(r=>r.status==="pending").length;
  if (b) { b.textContent = n ? String(n) : ""; b.style.display = n ? "inline-flex" : "none"; }
}

/* ══════════════════════════════════════════════
   PATIENT HELPERS
══════════════════════════════════════════════ */
function getMyReports() { return reportStore.filter(r=>r.patientEmail===currentUser?.email); }

function renderPatientRecent(): string {
  const mine = getMyReports();
  if (!mine.length) return `<div class="empty-state" style="padding:32px 0"><div class="empty-icon">${IC.inbox}</div><div class="empty-title">No activity yet</div><div class="empty-sub">Upload your first scan to get started.</div></div>`;
  return mine.slice().reverse().map(r=>`<div class="rrc-header" style="border:1px solid var(--border);border-radius:12px;padding:14px 18px;margin-bottom:10px">
    <div style="display:flex;align-items:center;gap:10px"><div class="rrc-avatar" style="background:var(--blue-light);color:var(--blue)">${IC.fileText}</div><div><div class="rrc-name">MRI — ${r.model.toUpperCase()}</div><div class="rrc-meta">${r.date}</div></div></div>
    <span class="status-pill ${r.status}">${r.status==="pending"?IC.clock:r.status==="approved"?IC.checkCircle:IC.close} ${r.status.charAt(0).toUpperCase()+r.status.slice(1)}</span>
  </div>`).join("");
}

function renderPatientReports(): string {
  const mine = getMyReports();
  if (!mine.length) return `<div class="empty-state"><div class="empty-icon">${IC.fileText}</div><div class="empty-title">No reports yet</div><div class="empty-sub">Once a doctor approves your analysis, your report will appear here.</div><button class="btn btn-primary" style="margin-top:16px" onclick="navTo('pt-upload')">${IC.upload} Upload a Scan</button></div>`;
  return mine.map((r, idx) => {
    if (r.status==="pending") return `<div class="report-review-card" style="border-left:3px solid var(--amber)"><div class="rrc-header"><div style="display:flex;align-items:center;gap:10px"><div class="rrc-avatar" style="background:var(--amber-light);color:var(--amber)">${IC.clock}</div><div><div class="rrc-name">Analysis #${idx+1}</div><div class="rrc-meta">${r.date}</div></div></div><span class="status-pill pending">${IC.clock} Awaiting doctor review</span></div><p style="font-size:13px;color:var(--text-3);margin-top:10px;padding:0 4px">Your scan has been analysed. A doctor will review and approve it shortly.</p></div>`;
    if (r.status==="rejected") return `<div class="report-review-card" style="border-left:3px solid var(--red)"><div class="rrc-header"><div style="display:flex;align-items:center;gap:10px"><div class="rrc-avatar" style="background:var(--red-light);color:var(--red)">${IC.close}</div><div><div class="rrc-name">Analysis #${idx+1}</div><div class="rrc-meta">${r.date}</div></div></div><span class="status-pill rejected">${IC.close} Rejected</span></div>${r.doctorNote?`<div class="rrc-note">${IC.stethoscope} <strong>Doctor's note:</strong> <em>${r.doctorNote}</em></div>`:""}</div>`;
    const m=r.result.metrics??{}; const v=r.result.tumor_volumes_cc??{};
    const sev=r.result.severity?.toLowerCase()??"low"; const scls=sev==="high"?"sev-high":sev==="low"?"sev-low":"sev-moderate";
    return `<div class="report-review-card" style="border-left:3px solid var(--green)"><div class="rrc-header"><div style="display:flex;align-items:center;gap:10px"><div class="rrc-avatar" style="background:var(--green-light);color:var(--green)">${IC.checkCircle}</div><div><div class="rrc-name">Analysis #${idx+1} — ${r.model.toUpperCase()}</div><div class="rrc-meta">${r.date}</div></div></div><span class="status-pill approved">${IC.checkCircle} Approved</span></div>
    <div class="rrc-metrics">
      <div class="rrc-metric"><span class="rrc-metric-label">ET Dice</span><span class="rrc-metric-val">${((m.dice_ET||0)*100).toFixed(1)}%</span></div>
      <div class="rrc-metric"><span class="rrc-metric-label">TC Dice</span><span class="rrc-metric-val">${((m.dice_TC||0)*100).toFixed(1)}%</span></div>
      <div class="rrc-metric"><span class="rrc-metric-label">WT Dice</span><span class="rrc-metric-val">${((m.dice_WT||0)*100).toFixed(1)}%</span></div>
      <div class="rrc-metric"><span class="rrc-metric-label">Total Tumor</span><span class="rrc-metric-val">${v.total_tumor_WT} cc</span></div>
    </div>
    <div style="margin-top:10px"><span class="severity-badge ${scls}">Severity: ${r.result.severity}</span></div>
    ${r.doctorNote?`<div class="rrc-note" style="margin-top:10px">${IC.stethoscope} <strong>Doctor's note:</strong> <em>${r.doctorNote}</em></div>`:""}
    </div>`;
  }).join("");
}

function updatePatientStats() {
  const mine = getMyReports();
  const s = (id: string, v: number) => { const el=document.getElementById(id); if(el) el.textContent=String(v); };
  s("pt-stat-uploads",  mine.length);
  s("pt-stat-approved", mine.filter(r=>r.status==="approved").length);
  s("pt-stat-pending",  mine.filter(r=>r.status==="pending").length);
}

(window as any).ptHandleUpload = (e: Event, mod: string) => {
  const file = (e.target as HTMLInputElement).files?.[0] ?? null;
  ptFiles[mod] = file;
  const zone=document.getElementById("pt-zone-"+mod)!; const fname=document.getElementById("pt-fname-"+mod)!;
  if(file){ zone.classList.add("has-file"); fname.textContent=file.name; }
  else    { zone.classList.remove("has-file"); fname.textContent=""; }
};

(window as any).patientSubmitScan = async () => {
  if (!Object.values(ptFiles).some(f=>f!==null)) { toast("Upload at least one NIfTI file","error"); return; }
  const btn = document.getElementById("pt-submit-btn") as HTMLButtonElement;
  const res = document.getElementById("pt-submit-result")!;
  btn.disabled=true; btn.innerHTML=IC.clock+" Submitting…";
  res.innerHTML=`<div class="loader-wrap"><div class="spinner-wrap"><div class="spinner-ring"></div><div class="spinner-ring"></div><div class="spinner-ring"></div></div><div class="loader-text">Analysing your MRI…</div><div class="loader-sub">This may take a moment</div></div>`;
  try {
    const form=new FormData(); form.append("model_id","segresnet");
    Object.entries(ptFiles).forEach(([k,v])=>{ if(v) form.append(k,v); });
    const resp = await fetch(API+"/segment",{method:"POST",body:form});
    const data = await resp.json();
    reportStore.push({ id:Date.now().toString(), patientName:currentUser!.name, patientEmail:currentUser!.email, date:new Date().toLocaleString(), model:"segresnet", result:data, status:"pending", doctorNote:"" });
    res.innerHTML=`<div class="card" style="border-color:var(--green);animation:pageIn 0.4s ease"><div class="card-title"><div class="card-title-icon" style="background:var(--green-light);color:var(--green)">${IC.checkCircle}</div>Submitted Successfully</div><div class="info-banner" style="background:var(--green-light);border-color:rgba(16,185,129,0.2);color:#065f46">${IC.checkCircle}<span>Your scan has been analysed and submitted to a doctor for review. Check <strong>My Reports</strong> once approved.</span></div></div>`;
    toast("Scan submitted for doctor review!","success");
    Object.keys(ptFiles).forEach(k=>ptFiles[k]=null);
    ["t1","t1ce","t2","flair"].forEach(m=>{ document.getElementById("pt-zone-"+m)?.classList.remove("has-file"); const fn=document.getElementById("pt-fname-"+m); if(fn) fn.textContent=""; });
    updatePatientStats(); updateReviewBadge();
  } catch {
    res.innerHTML=`<div class="card" style="border-color:var(--red)"><p style="color:var(--red);font-weight:600">${IC.alertCircle} Submission failed — is the backend running?</p></div>`;
    toast("Submission failed","error");
  } finally { btn.disabled=false; btn.innerHTML=IC.upload+" Submit for Analysis"; }
};

/* ══════════════════════════════════════════════
   NAV
══════════════════════════════════════════════ */
function bindNav() {
  document.querySelectorAll(".nav-item[data-page]").forEach(btn=>{
    btn.addEventListener("click",()=>navTo((btn as HTMLElement).dataset.page!));
  });
}
function navTo(page: string) {
  document.querySelectorAll(".nav-item[data-page]").forEach(b=>b.classList.toggle("active",(b as HTMLElement).dataset.page===page));
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  document.getElementById("page-"+page)?.classList.add("active");
  if (page==="models"||page==="detection") fetchModels();
  if (page==="dashboard"||page==="performance") fetchDashboard();
  if (page==="review")      { refreshReview(); }
  if (page==="pt-reports")  { const el=document.getElementById("pt-reports-list"); if(el) el.innerHTML=renderPatientReports(); }
  if (page==="pt-home")     { const el=document.getElementById("pt-recent"); if(el) el.innerHTML=renderPatientRecent(); updatePatientStats(); }
  if (page==="research") {
    fetch(API+"/models").then(r=>r.json()).then(data=>{ const el=document.getElementById("research-model-table"); if(el) el.innerHTML=buildModelTable(data.models); }).catch(()=>{});
  }
}
(window as any).navTo = navTo;

(window as any).switchTab = (btn: HTMLElement, group: string, tab: string) => {
  btn.closest(".tab-bar")!.querySelectorAll(".tab-item").forEach(b=>b.classList.remove("active")); btn.classList.add("active");
  document.querySelectorAll(`[id^="${group}-tab-"]`).forEach(p=>p.classList.remove("active"));
  document.getElementById(`${group}-tab-${tab}`)?.classList.add("active");
  if (group==="research"&&tab==="models") fetch(API+"/models").then(r=>r.json()).then(data=>{ const el=document.getElementById("research-model-table"); if(el) el.innerHTML=buildModelTable(data.models); }).catch(()=>{});
};

/* ══════════════════════════════════════════════
   API CALLS
══════════════════════════════════════════════ */
function buildModelTable(models: any[]): string {
  return `<table class="data-table"><thead><tr><th>Model</th><th>Dice Score</th><th style="min-width:130px">Performance</th><th>Description</th></tr></thead><tbody>${models.map((m:any)=>{const p=(m.dice_score*100).toFixed(1);const w=Math.round(m.dice_score*100);return `<tr><td>${m.name}</td><td><span class="dice-pill">${IC.target} ${p}%</span></td><td><div class="dice-bar-wrap"><div class="dice-bar-bg"><div class="dice-bar" style="width:${w}%"></div></div><span style="font-size:11px;color:var(--text-4)">${p}%</span></div></td><td style="font-size:12px">${m.description}</td></tr>`;}).join("")}</tbody></table>`;
}

async function fetchDashboard() {
  try {
    const [,mods] = await Promise.all([fetch(API+"/health").then(r=>r.json()), fetch(API+"/models").then(r=>r.json())]);
    ["perf-table","perf-model-table","detection-model-list"].forEach(id=>{ const el=document.getElementById(id); if(el) el.innerHTML=buildModelTable(mods.models); });
  } catch { /* offline */ }
}

async function fetchModels() {
  const grid=document.getElementById("model-grid"); if(!grid) return;
  grid.innerHTML=`<div class="loader-wrap"><div class="spinner-wrap"><div class="spinner-ring"></div><div class="spinner-ring"></div><div class="spinner-ring"></div></div></div>`;
  try {
    const data=await fetch(API+"/models").then(r=>r.json());
    grid.innerHTML=data.models.map((m:any)=>`<div class="model-card ${m.id===selectedModel?"selected":""}" onclick="selectModel('${m.id}','${m.name}')"><div class="model-card-header"><div class="model-name">${m.name}</div><span class="selected-badge">${IC.check} Active</span></div><div class="model-desc">${m.description}</div><div class="model-footer"><div class="model-dice">${IC.target} ${(m.dice_score*100).toFixed(1)}%</div><div class="model-arch-tag">3D</div></div></div>`).join("");
  } catch { grid.innerHTML=`<p style="color:var(--red);padding:20px">${IC.alertCircle} Could not load models</p>`; }
}

(window as any).selectModel=(id:string,name:string)=>{
  selectedModel=id;
  document.querySelectorAll(".model-card").forEach(c=>c.classList.remove("selected"));
  document.querySelectorAll<HTMLElement>(".model-card").forEach(c=>{ if(c.getAttribute("onclick")?.includes("'"+id+"'")) c.classList.add("selected"); });
  const lbl=document.getElementById("selected-model-label"); if(lbl) lbl.textContent=name;
  toast("Model selected: "+name,"success");
};

(window as any).handleUpload=(e:Event,mod:string)=>{
  const file=(e.target as HTMLInputElement).files?.[0]??null; uploadedFiles[mod]=file;
  const zone=document.getElementById("zone-"+mod)!; const fname=document.getElementById("fname-"+mod)!;
  if(file){zone.classList.add("has-file"); fname.textContent=file.name;} else{zone.classList.remove("has-file"); fname.textContent="";}
};
(window as any).clearUploads=()=>{
  Object.keys(uploadedFiles).forEach(k=>uploadedFiles[k]=null);
  ["t1","t1ce","t2","flair"].forEach(m=>{ document.getElementById("zone-"+m)?.classList.remove("has-file"); const fn=document.getElementById("fname-"+m); if(fn) fn.textContent=""; });
  const r=document.getElementById("seg-result"); if(r) r.innerHTML="";
  toast("Files cleared","info");
};
(window as any).runSegmentation=async()=>{
  if(!Object.values(uploadedFiles).some(f=>f!==null)){toast("Upload at least one NIfTI file","error");return;}
  const btn=document.getElementById("run-seg-btn") as HTMLButtonElement;
  btn.disabled=true; btn.innerHTML=IC.clock+" Processing…";
  const res=document.getElementById("seg-result")!;
  res.innerHTML=`<div class="loader-wrap"><div class="spinner-wrap"><div class="spinner-ring"></div><div class="spinner-ring"></div><div class="spinner-ring"></div></div><div class="loader-text">Running segmentation…</div></div>`;
  try {
    const form=new FormData(); form.append("model_id",selectedModel);
    Object.entries(uploadedFiles).forEach(([k,v])=>{if(v) form.append(k,v);});
    const r=await fetch(API+"/segment",{method:"POST",body:form});
    res.innerHTML=renderSegResult(await r.json()); toast("Segmentation complete!","success");
  } catch { res.innerHTML=`<div class="card" style="border-color:var(--red)"><p style="color:var(--red);font-weight:600">${IC.alertCircle} Segmentation failed</p></div>`; toast("Failed","error"); }
  finally { btn.disabled=false; btn.innerHTML=IC.scan+" Run Segmentation"; }
};

function renderSegResult(r:any): string {
  const sev=r.severity?.toLowerCase()??"low"; const vols=r.tumor_volumes_cc??{}; const mets=r.metrics??{};
  const scls=sev==="high"?"sev-high":sev==="low"?"sev-low":"sev-moderate";
  return `<div class="card" style="border-color:var(--blue);animation:pageIn 0.4s ease">
    <div class="card-title"><div class="card-title-icon" style="background:var(--blue-light);color:var(--blue)">${IC.activity}</div>Segmentation Results<span style="margin-left:auto;font-size:11px;font-weight:500;color:var(--text-4)">Model: ${r.model?.toUpperCase()}</span></div>
    <div class="result-grid">
      <div>
        <div class="section-label">Dice Scores</div>
        <div class="metric-row"><span class="metric-name">Enhancing Tumor (ET)</span><span class="metric-val">${(mets.dice_ET*100).toFixed(1)}%</span></div>
        <div class="metric-row"><span class="metric-name">Tumor Core (TC)</span><span class="metric-val">${(mets.dice_TC*100).toFixed(1)}%</span></div>
        <div class="metric-row"><span class="metric-name">Whole Tumor (WT)</span><span class="metric-val">${(mets.dice_WT*100).toFixed(1)}%</span></div>
        <div style="margin-top:20px"><div class="section-label">Severity</div><span class="severity-badge ${scls}">● ${r.severity}</span></div>
      </div>
      <div>
        <div class="section-label">Tumor Volumes</div>
        <div class="vol-row et"><span class="vol-name">Enhancing Tumor (ET)</span><span class="vol-val">${vols.enhancing_tumor_ET} cc</span></div>
        <div class="vol-row ncr"><span class="vol-name">Necrotic Core (NCR)</span><span class="vol-val">${vols.necrotic_core_NCR} cc</span></div>
        <div class="vol-row ed"><span class="vol-name">Peritumoral Edema (ED)</span><span class="vol-val">${vols.peritumoral_edema_ED} cc</span></div>
        <div class="vol-row wt"><span class="vol-name">Whole Tumor (WT)</span><span class="vol-val">${vols.total_tumor_WT} cc</span></div>
      </div>
    </div>
  </div>`;
}

(window as any).addGrowthPoint=()=>{ const vol=parseFloat((document.getElementById("vol-input") as HTMLInputElement).value); const day=parseFloat((document.getElementById("day-input") as HTMLInputElement).value); if(isNaN(vol)||isNaN(day)){toast("Enter valid values","error");return;} growthPoints.push({vol,day}); growthPoints.sort((a,b)=>a.day-b.day); renderGrowthPoints(); (document.getElementById("vol-input") as HTMLInputElement).value=""; (document.getElementById("day-input") as HTMLInputElement).value=""; };
(window as any).removeGrowthPoint=(i:number)=>{growthPoints.splice(i,1);renderGrowthPoints();};
(window as any).clearGrowthPoints=()=>{growthPoints=[];renderGrowthPoints();const r=document.getElementById("growth-result");if(r)r.innerHTML="";};
function renderGrowthPoints(){const el=document.getElementById("datapoint-list");if(!el)return;if(!growthPoints.length){el.innerHTML='<span style="font-size:12px;color:var(--text-4)">No data points yet</span>';return;}el.innerHTML=growthPoints.map((p,i)=>`<div class="datapoint-chip"><span>Day ${p.day}: <strong>${p.vol} cc</strong></span><span class="chip-remove" onclick="removeGrowthPoint(${i})">×</span></div>`).join("");}
(window as any).runGrowthPrediction=async()=>{
  if(!growthPoints.length){toast("Add at least one data point","error");return;}
  const res=document.getElementById("growth-result")!;
  res.innerHTML=`<div class="loader-wrap"><div class="spinner-wrap"><div class="spinner-ring"></div><div class="spinner-ring"></div><div class="spinner-ring"></div></div><div class="loader-text">Predicting growth…</div></div>`;
  try {
    const form=new FormData(); form.append("volumes",JSON.stringify(growthPoints.map(p=>p.vol))); form.append("timepoints",JSON.stringify(growthPoints.map(p=>p.day)));
    const r=await fetch(API+"/growth-predict",{method:"POST",body:form}); res.innerHTML=renderGrowthResult(await r.json()); toast("Prediction ready!","success");
  } catch { res.innerHTML=`<div class="card" style="border-color:var(--red)"><p style="color:var(--red)">${IC.alertCircle} Prediction failed</p></div>`; toast("Failed","error"); }
};
function renderGrowthResult(r:any): string {
  const preds=r.predictions??{}; const allV=[...growthPoints.map(p=>p.vol),preds.day_30,preds.day_60,preds.day_90].filter(Boolean) as number[];
  const maxV=Math.max(...allV,1); const barH=(v:number)=>Math.max(10,Math.round((v/maxV)*110));
  const risk=r.risk_assessment??"—"; const rcls=risk.toLowerCase().includes("stable")?"sev-low":risk.toLowerCase().includes("rapid")?"sev-high":"sev-moderate";
  return `<div class="card" style="animation:pageIn 0.4s ease"><div class="card-title"><div class="card-title-icon" style="background:var(--purple-light);color:var(--purple)">${IC.trendUp}</div>Growth Prediction</div>
    <div class="result-grid"><div>
      <div class="section-label">Predicted Volumes</div>
      <div class="metric-row"><span class="metric-name">+30 days</span><span class="metric-val" style="color:var(--blue)">${preds.day_30?.toFixed(2)} cc</span></div>
      <div class="metric-row"><span class="metric-name">+60 days</span><span class="metric-val" style="color:var(--purple)">${preds.day_60?.toFixed(2)} cc</span></div>
      <div class="metric-row"><span class="metric-name">+90 days</span><span class="metric-val" style="color:var(--red)">${preds.day_90?.toFixed(2)} cc</span></div>
      <div class="metric-row"><span class="metric-name">Growth Rate</span><span class="metric-val" style="color:var(--amber)">${r.growth_rate_cc_per_day?.toFixed(4)} cc/day</span></div>
      <div style="margin-top:14px"><span class="severity-badge ${rcls}">● ${risk}</span></div>
    </div><div>
      <div class="section-label">Volume Trajectory</div>
      <div class="chart-area"><div class="chart-bars">
        ${growthPoints.map(p=>`<div class="bar-group"><div class="bar-val">${p.vol}</div><div class="bar hist" style="height:${barH(p.vol)}px"></div><div class="bar-label">D${p.day}</div></div>`).join("")}
        ${([[30,preds.day_30],[60,preds.day_60],[90,preds.day_90]] as [number,number][]).map(([d,v])=>`<div class="bar-group"><div class="bar-val">${v?.toFixed(1)}</div><div class="bar pred" style="height:${barH(v)}px"></div><div class="bar-label">+${d}d</div></div>`).join("")}
      </div><div class="chart-legend"><span><span class="legend-dot" style="background:var(--blue)"></span>Historical</span><span><span class="legend-dot" style="background:var(--purple)"></span>Predicted</span></div></div>
    </div></div></div>`;
}

(window as any).testEndpoint=async(method:string,path:string)=>{
  const card=document.getElementById("api-response-card")!; const body=document.getElementById("api-response-body")!;
  card.style.display="block"; body.textContent="Loading…"; card.scrollIntoView({behavior:"smooth"});
  try { const r=await fetch(API+path,{method}); body.textContent=JSON.stringify(await r.json(),null,2); toast(method+" "+path+" → "+r.status,r.ok?"success":"error"); }
  catch(e){ body.textContent="Error: "+e; toast("Request failed","error"); }
};

/* ══════════════════════════════════════════════
   GLOBAL HELPERS
══════════════════════════════════════════════ */
(window as any).logout=()=>{ currentUser=null; showAuth("login"); toast("Signed out","info"); };

function toast(msg:string,type:"success"|"error"|"info"="info"){
  const c=document.getElementById("toasts")||document.body;
  const el=document.createElement("div"); el.className="toast "+type;
  const icon=type==="success"?IC.checkCircle:type==="error"?IC.alertCircle:IC.bell;
  el.innerHTML=`<span class="toast-icon">${icon}</span><span>${msg}</span>`;
  c.appendChild(el); setTimeout(()=>el.remove(),3500);
}

function spawnParticles(){
  const colors=["#3b6ef8","#8b5cf6","#06b6d4","#10b981","#f59e0b"];
  for(let i=0;i<12;i++){
    const el=document.createElement("div"); el.className="particle";
    const size=4+Math.random()*7;
    el.style.cssText=`width:${size}px;height:${size}px;left:${Math.random()*100}vw;background:${colors[Math.floor(Math.random()*colors.length)]};animation-duration:${8+Math.random()*12}s;animation-delay:${Math.random()*10}s;opacity:0;`;
    document.body.appendChild(el);
  }
}
