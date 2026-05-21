/* ===== GLOBAL LINKERS LTD — APP.JS (Live API Edition) ===== */

const API = 'http://localhost:4000/api';

const getToken = () => localStorage.getItem('gl_token');
const setToken = (t) => localStorage.setItem('gl_token', t);
const clearToken = () => localStorage.removeItem('gl_token');
const authHeaders = () => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` });

// HTML-encode user-supplied values before inserting into innerHTML (XSS prevention)
function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function apiFetch(path, opts = {}) {
  try {
    const res = await fetch(API + path, opts);
    let data;
    const ct = res.headers.get('content-type') || '';
    try {
      data = ct.includes('application/json') ? await res.json() : { error: await res.text() };
    } catch { data = { error: `HTTP ${res.status}` }; }
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  } catch (err) { console.error('API error:', path, err.message); throw err; }
}

// Cache fetched jobs so openApplyModal can look them up by ID
const _jobs = {};

// Track whether any contact/employer form has unsaved input
let formDirty = false;

function showPage(page) {
  if (formDirty && !confirm('You have unsaved changes. Leave this page?')) return;
  formDirty = false;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');
  document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.page === page));
  window.scrollTo({ top: 0, behavior: 'smooth' });
  closeMenu();
  if (page === 'jobs') loadJobs();
}

window.addEventListener('scroll', () => document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 10));
function toggleMenu() { document.getElementById('navLinks').classList.toggle('open'); }
function closeMenu() { document.getElementById('navLinks').classList.remove('open'); }
function doHeroSearch() { const q = document.getElementById('heroSearch').value; document.getElementById('jobSearch').value = q; showPage('jobs'); }
function quickSearch(q) { document.getElementById('jobSearch').value = q; showPage('jobs'); }

async function loadFeaturedJobs() {
  const grid = document.getElementById('featuredJobsGrid');
  if (!grid) return;
  grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:#999"><div style="font-size:32px;margin-bottom:8px">⏳</div>Loading featured jobs...</div>`;
  try {
    const { jobs } = await apiFetch('/jobs?featured=true&limit=6');
    if (!jobs.length) { grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:#999">No featured jobs yet.</div>`; return; }
    jobs.forEach(j => { _jobs[j.id] = j; });
    grid.innerHTML = jobs.map(job => `
      <div class="job-preview-card" onclick="showPage('jobs')">
        <div class="job-card-header">
          <div class="job-company-logo" style="background:${esc(job.logo_color||'#0A3D91')}">${esc(job.logo_initials||'GL')}</div>
          <span class="job-badge ${job.job_type==='Remote'?'remote':job.job_type==='Contract'?'contract':'full-time'}">${esc(job.job_type)}</span>
        </div>
        <div class="job-card-title">${esc(job.title)}</div>
        <div class="job-card-company">${esc(job.company)}</div>
        <div class="job-card-meta">
          <span class="job-meta-item">📍 ${esc(job.location)}</span>
          <span class="job-meta-item">🎯 ${esc(job.experience||'Open')}</span>
        </div>
        <div class="job-card-footer">
          <span class="job-card-salary">${esc(job.salary_display||'Competitive')}</span>
          <span class="job-card-date">${esc(job.posted_display||'Recently')}</span>
        </div>
      </div>`).join('');
  } catch (err) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:#999">Could not load jobs. <button onclick="loadFeaturedJobs()" style="margin-left:8px;background:none;border:1px solid #ccc;border-radius:6px;padding:6px 14px;cursor:pointer">Retry</button></div>`;
  }
}

let currentPage = 1;

async function loadJobs() {
  const list = document.getElementById('jobsList');
  const countEl = document.getElementById('jobCount');
  if (!list) return;
  const search = document.getElementById('jobSearch')?.value || '';
  const location = document.getElementById('locationSearch')?.value || '';
  const category = document.getElementById('categoryFilter')?.value || '';
  const type = document.getElementById('typeFilter')?.value || '';
  list.innerHTML = `<div style="text-align:center;padding:60px 0;color:#999"><div style="font-size:40px;margin-bottom:12px">⏳</div>Loading jobs...</div>`;
  try {
    const params = new URLSearchParams({ page: currentPage, limit: 10, ...(search && {search}), ...(location && {location}), ...(category && {category}), ...(type && {job_type: type}) });
    const { jobs, pagination } = await apiFetch(`/jobs?${params}`);
    jobs.forEach(j => { _jobs[j.id] = j; });
    countEl.textContent = `${pagination.total} job${pagination.total !== 1 ? 's' : ''} found`;
    if (!jobs.length) { list.innerHTML = `<div style="text-align:center;padding:60px 0;color:var(--grey-mid)"><div style="font-size:48px;margin-bottom:16px">🔍</div><h3 style="font-family:Montserrat,sans-serif;color:var(--blue);margin-bottom:8px">No jobs found</h3><p>Try adjusting your search filters</p></div>`; return; }
    list.innerHTML = jobs.map(job => `
      <div class="job-list-card ${job.is_featured ? 'featured-job' : ''}"
           data-jid="${esc(job.id)}" data-jtitle="${esc(job.title)}" data-jco="${esc(job.company)}"
           onclick="openJobDetail(this.dataset.jid)">
        <div class="jlc-logo" style="background:${esc(job.logo_color||'#0A3D91')}">${esc(job.logo_initials||'GL')}</div>
        <div class="jlc-body">
          <div class="jlc-title">${esc(job.title)} ${job.is_featured ? '<span class="jlc-tag blue" style="display:inline-block;margin-left:8px">⭐ Featured</span>' : ''}</div>
          <div class="jlc-company">${esc(job.company)}</div>
          <div class="jlc-tags"><span class="jlc-tag">${esc(job.category||'General')}</span><span class="jlc-tag">${esc(job.experience||'Open')}</span><span class="jlc-tag ${job.job_type==='Remote'?'blue':''}">${esc(job.job_type)}</span></div>
          <div class="jlc-meta"><span>📍 ${esc(job.location)}</span><span>🕒 ${esc(job.posted_display||'Recently')}</span><span>👥 ${job.applications_count||0} applicant${job.applications_count!==1?'s':''}</span></div>
        </div>
        <div class="jlc-right">
          <span class="jlc-salary">${esc(job.salary_display||'Competitive')}</span>
          <button class="btn-primary" style="font-size:13px;padding:10px 20px"
                  onclick="event.stopPropagation();openApplyModal(this.closest('[data-jid]').dataset.jid,this.closest('[data-jid]').dataset.jtitle,this.closest('[data-jid]').dataset.jco)">Apply Now</button>
        </div>
      </div>`).join('');
    renderPagination(pagination);
  } catch (err) {
    list.innerHTML = `<div style="text-align:center;padding:60px 0;color:#999"><div style="font-size:40px;margin-bottom:12px">⚠️</div>Could not load jobs.<br><button onclick="loadJobs()" style="margin-top:16px;background:none;border:1px solid #ccc;border-radius:6px;padding:8px 20px;cursor:pointer">Retry</button></div>`;
  }
}

function filterJobs() { currentPage = 1; loadJobs(); }

function renderPagination(pagination) {
  const el = document.querySelector('.pagination');
  if (!el || pagination.pages <= 1) { if (el) el.innerHTML = ''; return; }
  let html = '';
  if (currentPage > 1) html += `<button class="page-btn" onclick="goPage(${currentPage-1})">←</button>`;
  for (let i = 1; i <= pagination.pages; i++) html += `<button class="page-btn ${i===currentPage?'active':''}" onclick="goPage(${i})">${i}</button>`;
  if (currentPage < pagination.pages) html += `<button class="page-btn" onclick="goPage(${currentPage+1})">→</button>`;
  el.innerHTML = html;
}

function goPage(p) { currentPage = p; loadJobs(); window.scrollTo({top:400,behavior:'smooth'}); }

async function openJobDetail(jobId) {
  const modal = document.getElementById('addJobModal');
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.innerHTML = `<div class="modal-box" onclick="event.stopPropagation()" style="max-width:680px"><div style="text-align:center;padding:40px;color:#999"><div style="font-size:32px;margin-bottom:8px">⏳</div>Loading...</div></div>`;
  modal.style.display = 'flex';
  try {
    const { job } = await apiFetch(`/jobs/${jobId}`);
    _jobs[job.id] = job;
    modal.innerHTML = `
      <div class="modal-box" onclick="event.stopPropagation()" style="max-width:680px">
        <div class="modal-header">
          <div style="display:flex;align-items:center;gap:16px">
            <div style="width:52px;height:52px;background:${esc(job.logo_color||'#0A3D91')};border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-family:Montserrat,sans-serif;font-weight:800;font-size:16px;flex-shrink:0">${esc(job.logo_initials||'GL')}</div>
            <div><h3 style="margin:0">${esc(job.title)}</h3><p style="color:var(--grey-mid);font-size:14px;margin:4px 0 0">${esc(job.company)}</p></div>
          </div>
          <button onclick="closeModal()" class="modal-close">✕</button>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px">
          <span class="jlc-tag blue" style="padding:5px 14px">${esc(job.job_type)}</span>
          <span class="jlc-tag" style="padding:5px 14px">📍 ${esc(job.location)}</span>
          <span class="jlc-tag" style="padding:5px 14px">🎯 ${esc(job.experience||'Open')}</span>
          <span class="jlc-tag" style="padding:5px 14px;color:var(--blue);font-weight:700">${esc(job.salary_display||'Competitive')}</span>
        </div>
        <h4 style="font-family:Montserrat,sans-serif;color:var(--blue);margin-bottom:8px">About the Role</h4>
        <p style="color:var(--grey-mid);line-height:1.8;margin-bottom:20px;font-size:15px">${esc(job.description).replace(/\n/g,'<br>')}</p>
        ${job.requirements?`<h4 style="font-family:Montserrat,sans-serif;color:var(--blue);margin-bottom:8px">Requirements</h4><p style="color:var(--grey-mid);line-height:1.8;margin-bottom:20px;font-size:15px">${esc(job.requirements).replace(/\n/g,'<br>')}</p>`:''}
        <div style="display:flex;gap:12px;margin-top:8px">
          <button class="btn-primary large" style="flex:1"
                  data-jid="${esc(job.id)}" data-jtitle="${esc(job.title)}" data-jco="${esc(job.company)}"
                  onclick="closeModal();openApplyModal(this.dataset.jid,this.dataset.jtitle,this.dataset.jco)">Apply for This Role</button>
          <button class="btn-outline-blue" onclick="closeModal()">Back</button>
        </div>
      </div>`;
  } catch(err) {
    modal.innerHTML = `<div class="modal-box" onclick="event.stopPropagation()"><p style="padding:20px;color:#999">Could not load job details.</p><button class="btn-outline-blue" onclick="closeModal()">Close</button></div>`;
  }
}

function openApplyModal(jobId, jobTitle, company) {
  const modal = document.getElementById('addJobModal');
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.innerHTML = `
    <div class="modal-box" onclick="event.stopPropagation()" style="max-width:640px">
      <div class="modal-header">
        <div><h3>Apply: ${esc(jobTitle)}</h3><p style="color:var(--grey-mid);font-size:13px;margin-top:4px">${esc(company)}</p></div>
        <button onclick="closeModal()" class="modal-close">✕</button>
      </div>
      <form id="applyForm" onsubmit="submitApplication(event,'${esc(jobId)}')" style="display:flex;flex-direction:column;gap:16px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <div class="form-group"><label for="applyName">Full Name *</label><input type="text" id="applyName" required/></div>
          <div class="form-group"><label for="applyEmail">Email *</label><input type="email" id="applyEmail" required/></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <div class="form-group"><label for="applyPhone">Phone</label><input type="tel" id="applyPhone"/></div>
          <div class="form-group"><label for="applyRole">Current Title</label><input type="text" id="applyRole"/></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <div class="form-group"><label for="applyEmployer">Current Employer</label><input type="text" id="applyEmployer"/></div>
          <div class="form-group"><label for="applyExp">Years Experience</label><input type="number" id="applyExp" min="0" max="50"/></div>
        </div>
        <div class="form-group"><label for="applyLinkedin">LinkedIn URL</label><input type="url" id="applyLinkedin" placeholder="https://linkedin.com/in/yourname"/></div>
        <div class="form-group"><label for="applyCover">Cover Letter</label><textarea id="applyCover" rows="4" placeholder="Why are you the right fit?"></textarea></div>
        <div class="form-group">
          <label>Upload CV <span style="color:var(--grey-light);font-weight:400">(optional · PDF, DOC, DOCX · max 5 MB)</span></label>
          <div id="cvDropZone" style="border:2px dashed var(--border);border-radius:10px;padding:20px;text-align:center;cursor:pointer;transition:border-color 0.2s;position:relative"
               onclick="document.getElementById('applyCvFile').click()"
               ondragover="event.preventDefault();this.style.borderColor='var(--blue)'"
               ondragleave="this.style.borderColor='var(--border)'"
               ondrop="handleCvDrop(event)">
            <input type="file" id="applyCvFile" accept=".pdf,.doc,.docx" style="display:none" onchange="handleCvSelect(this)"/>
            <div id="cvDropLabel" style="color:var(--grey-mid);font-size:14px">
              📎 Click to browse or drag &amp; drop your CV here
            </div>
          </div>
          <div id="cvError" style="color:#dc2626;font-size:13px;margin-top:6px;display:none"></div>
        </div>
        <div style="display:flex;gap:12px">
          <button type="submit" class="btn-primary large" style="flex:1" id="applySubmitBtn">Submit Application</button>
          <button type="button" class="btn-outline-blue" onclick="closeModal()">Cancel</button>
        </div>
      </form>
    </div>`;
  modal.style.display = 'flex';
  // Focus first input for accessibility
  setTimeout(() => document.getElementById('applyName')?.focus(), 50);
}

const CV_MAX_BYTES = 5 * 1024 * 1024;
const CV_ALLOWED_EXTS = ['.pdf', '.doc', '.docx'];

function handleCvSelect(input) {
  const file = input.files[0];
  const errEl = document.getElementById('cvError');
  const label = document.getElementById('cvDropLabel');
  const zone  = document.getElementById('cvDropZone');
  errEl.style.display = 'none';
  errEl.textContent = '';
  if (!file) return;
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  if (!CV_ALLOWED_EXTS.includes(ext)) {
    errEl.textContent = 'Only PDF, DOC, or DOCX files are allowed.';
    errEl.style.display = 'block';
    input.value = '';
    return;
  }
  if (file.size > CV_MAX_BYTES) {
    errEl.textContent = `File is too large (${(file.size/1024/1024).toFixed(1)} MB). Maximum allowed size is 5 MB.`;
    errEl.style.display = 'block';
    input.value = '';
    return;
  }
  label.innerHTML = `✅ <strong>${esc(file.name)}</strong> &nbsp;<span style="color:var(--grey-light)">(${(file.size/1024).toFixed(0)} KB)</span> &nbsp;<a href="#" onclick="clearCv(event)" style="color:#dc2626;font-size:12px">Remove</a>`;
  zone.style.borderColor = 'var(--blue)';
}

function handleCvDrop(event) {
  event.preventDefault();
  document.getElementById('cvDropZone').style.borderColor = 'var(--border)';
  const file = event.dataTransfer.files[0];
  if (!file) return;
  const input = document.getElementById('applyCvFile');
  const dt = new DataTransfer();
  dt.items.add(file);
  input.files = dt.files;
  handleCvSelect(input);
}

function clearCv(e) {
  e.preventDefault();
  const input = document.getElementById('applyCvFile');
  input.value = '';
  document.getElementById('cvDropLabel').innerHTML = '📎 Click to browse or drag &amp; drop your CV here';
  document.getElementById('cvDropZone').style.borderColor = 'var(--border)';
  document.getElementById('cvError').style.display = 'none';
}

async function submitApplication(e, jobId) {
  e.preventDefault();
  const errEl = document.getElementById('cvError');
  if (errEl && errEl.style.display !== 'none') return;

  const btn = document.getElementById('applySubmitBtn');
  btn.textContent = 'Submitting...'; btn.disabled = true;

  const fileInput = document.getElementById('applyCvFile');
  const file = fileInput && fileInput.files[0];

  try {
    let response;
    if (file) {
      const fd = new FormData();
      fd.append('job_id',           jobId);
      fd.append('full_name',        document.getElementById('applyName').value);
      fd.append('email',            document.getElementById('applyEmail').value);
      fd.append('phone',            document.getElementById('applyPhone').value || '');
      fd.append('current_position', document.getElementById('applyRole').value || '');
      fd.append('current_employer', document.getElementById('applyEmployer').value || '');
      fd.append('experience_years', document.getElementById('applyExp').value || '');
      fd.append('linkedin_url',     document.getElementById('applyLinkedin').value || '');
      fd.append('cover_letter',     document.getElementById('applyCover').value || '');
      fd.append('cv', file);
      const res = await fetch(API + '/applications', { method: 'POST', body: fd });
      const ct = res.headers.get('content-type') || '';
      const data = ct.includes('application/json') ? await res.json() : { error: await res.text() };
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      response = data;
    } else {
      response = await apiFetch('/applications', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: jobId, full_name: document.getElementById('applyName').value, email: document.getElementById('applyEmail').value, phone: document.getElementById('applyPhone').value, current_position: document.getElementById('applyRole').value, current_employer: document.getElementById('applyEmployer').value, experience_years: parseInt(document.getElementById('applyExp').value)||null, linkedin_url: document.getElementById('applyLinkedin').value, cover_letter: document.getElementById('applyCover').value })
      });
    }
    closeModal();
    showToast('Application submitted! We will be in touch soon.', 'success');
    loadJobs();
  } catch(err) {
    btn.textContent = 'Submit Application'; btn.disabled = false;
    showToast(err.message || 'Failed to submit', 'error');
  }
}

async function submitJob(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  btn.textContent = 'Submitting...'; btn.disabled = true;
  try {
    await apiFetch('/employer-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_name:       document.getElementById('jCompanyName').value,
        industry:           document.getElementById('jIndustry').value,
        job_title:          document.getElementById('jJobTitle').value,
        department:         document.getElementById('jDepartment').value,
        job_type:           document.getElementById('jJobType').value,
        location:           document.getElementById('jLocation').value,
        salary_range:       document.getElementById('jSalary').value,
        experience_required:document.getElementById('jExperience').value,
        description:        document.getElementById('jDescription').value,
        contact_name:       document.getElementById('jContactName').value,
        contact_email:      document.getElementById('jContactEmail').value,
        contact_phone:      document.getElementById('jContactPhone').value,
      })
    });
    formDirty = false;
    showToast('Request submitted! We will contact you within 2 hours.', 'success');
    e.target.reset();
  } catch(err) { showToast(err.message||'Submission failed', 'error'); }
  finally { btn.textContent = 'Submit Job Vacancy'; btn.disabled = false; }
}

async function submitContact(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  btn.textContent = 'Sending...'; btn.disabled = true;
  try {
    await apiFetch('/enquiries', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: document.getElementById('cFullName').value,
        email:     document.getElementById('cEmail').value,
        phone:     document.getElementById('cPhone').value,
        user_type: document.getElementById('cUserType').value,
        subject:   document.getElementById('cSubject').value,
        message:   document.getElementById('cMessage').value,
      })
    });
    formDirty = false;
    showToast('Message sent! We will reply within 24 hours.', 'success');
    e.target.reset();
  } catch(err) { showToast(err.message||'Failed to send', 'error'); }
  finally { btn.textContent = 'Send Message'; btn.disabled = false; }
}

async function adminLogin(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type=submit]');
  btn.textContent = 'Signing in...'; btn.disabled = true;
  try {
    const data = await apiFetch('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: document.getElementById('adminUser').value, password: document.getElementById('adminPass').value })
    });
    setToken(data.token);
    document.getElementById('admin-login').style.display = 'none';
    document.getElementById('admin-dashboard').style.display = 'block';
    initAdminDashboard();
  } catch(err) { showToast(err.message||'Invalid credentials', 'error'); btn.textContent = 'Sign In'; btn.disabled = false; }
}

function adminLogout() { clearToken(); document.getElementById('admin-login').style.display = 'flex'; document.getElementById('admin-dashboard').style.display = 'none'; document.getElementById('adminPass').value = ''; showPage('home'); }

async function initAdminDashboard() {
  document.getElementById('adminDate').textContent = new Date().toLocaleDateString('en-NG', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  try {
    const data = await apiFetch('/admin/dashboard', { headers: authHeaders() });
    const kpis = data?.kpis || {};
    const vals = [kpis.active_jobs, kpis.new_applications, kpis.active_employers, kpis.total_placements, kpis.pending_enquiries];
    document.querySelectorAll('.kpi-num').forEach((el, i) => { if (vals[i] !== undefined) el.textContent = vals[i]; });
    const appsTable = document.getElementById('recentAppsTable');
    if (appsTable) appsTable.innerHTML = (data.recent_applications||[]).map(a => `<tr><td><strong>${esc(a.full_name)}</strong></td><td style="color:var(--grey-mid)">${esc(a.job_title||'—')}</td><td><span class="status-badge status-${esc(a.status)}">${capitalize(a.status)}</span></td></tr>`).join('') || '<tr><td colspan="3" style="text-align:center;color:#999;padding:20px">No applications yet</td></tr>';
    const reqTable = document.getElementById('recentRequestsTable');
    if (reqTable) reqTable.innerHTML = (data.recent_requests||[]).map(r => `<tr><td><strong>${esc(r.company_name)}</strong></td><td style="color:var(--grey-mid)">${esc(r.job_title)}</td><td><span class="status-badge ${r.urgency==='urgent'?'status-closed':r.urgency==='high'?'status-interview':'status-active'}">${capitalize(r.urgency)}</span></td></tr>`).join('') || '<tr><td colspan="3" style="text-align:center;color:#999;padding:20px">No requests yet</td></tr>';
  } catch(err) { showToast('Could not load dashboard data', 'error'); }
}

function showAdminTab(tab, el) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.admin-nav-link').forEach(l => l.classList.remove('active'));
  const t = document.getElementById('admin-tab-' + tab);
  if (t) t.classList.add('active');
  if (el) el.classList.add('active');
  if (tab === 'jobs') loadAdminJobs();
  if (tab === 'candidates') loadAdminApplications();
  if (tab === 'employers') loadAdminRequests();
  if (tab === 'enquiries') loadAdminEnquiries();
}

async function loadAdminJobs() {
  const tbody = document.getElementById('adminJobsTable');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:#999">Loading...</td></tr>';
  try {
    const { jobs } = await apiFetch('/admin/jobs?limit=50', { headers: authHeaders() });
    tbody.innerHTML = jobs.length ? jobs.map(j => `<tr><td><strong>${esc(j.title)}</strong></td><td>${esc(j.company)}</td><td>${esc(j.location)}</td><td>${esc(j.job_type)}</td><td><span class="status-badge ${j.is_active?'status-active':'status-closed'}">${j.is_active?'Active':'Inactive'}</span></td><td style="color:var(--grey-mid);font-size:13px">${new Date(j.created_at).toLocaleDateString()}</td><td><button onclick="toggleJobStatus('${esc(j.id)}',${j.is_active})" style="background:none;border:1px solid var(--border);border-radius:6px;padding:4px 10px;cursor:pointer;font-size:12px;color:${j.is_active?'#dc2626':'#15803d'}">${j.is_active?'Deactivate':'Activate'}</button></td></tr>`).join('') : '<tr><td colspan="7" style="text-align:center;padding:20px;color:#999">No jobs yet.</td></tr>';
  } catch(err) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:#999">Could not load jobs.</td></tr>'; }
}

async function toggleJobStatus(id, currentActive) {
  try {
    await apiFetch(`/admin/jobs/${id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ is_active: !currentActive }) });
    showToast(`Job ${currentActive?'deactivated':'activated'}`, 'success');
    loadAdminJobs();
  } catch(err) { showToast('Failed to update job', 'error'); }
}

async function loadAdminApplications() {
  const tbody = document.getElementById('adminCandidatesTable');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:#999">Loading...</td></tr>';
  try {
    const { applications } = await apiFetch('/admin/applications?limit=50', { headers: authHeaders() });
    tbody.innerHTML = applications.length ? applications.map(a => `<tr>
      <td><strong>${esc(a.full_name)}</strong><br><small style="color:#999">${esc(a.email)}</small></td>
      <td>${esc(a.job_title||'—')}<br><small style="color:#999">${esc(a.company||'')}</small></td>
      <td>${a.experience_years?esc(a.experience_years)+' yrs':'—'}</td>
      <td>${esc(a.location||'—')}</td>
      <td><select onchange="updateAppStatus('${esc(a.id)}',this.value)" style="border:1px solid var(--border);border-radius:6px;padding:4px 8px;font-size:12px;font-family:Montserrat,sans-serif">${['new','reviewing','shortlisted','interview','offered','placed','rejected'].map(s=>`<option value="${s}" ${a.status===s?'selected':''}>${capitalize(s)}</option>`).join('')}</select></td>
      <td style="color:var(--grey-mid);font-size:13px">${new Date(a.created_at).toLocaleDateString()}</td>
      <td>${a.cv_url ? `<a href="${esc(a.cv_url)}" target="_blank" rel="noopener noreferrer" style="color:var(--blue);font-size:12px;white-space:nowrap">⬇ Download</a>` : '<span style="color:#999">—</span>'}</td>
    </tr>`).join('') : '<tr><td colspan="7" style="text-align:center;padding:20px;color:#999">No applications yet.</td></tr>';
  } catch(err) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:#999">Could not load applications.</td></tr>'; }
}

async function updateAppStatus(id, status) {
  try {
    await apiFetch(`/admin/applications/${id}/status`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ status }) });
    showToast(`Status updated: ${capitalize(status)}`, 'success');
    if (status === 'placed') showToast('Placement recorded automatically!', 'success');
  } catch(err) { showToast('Failed to update status', 'error'); }
}

async function loadAdminRequests() {
  const tbody = document.getElementById('adminEmployersTable');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:#999">Loading...</td></tr>';
  try {
    const { requests } = await apiFetch('/admin/employer-requests?limit=50', { headers: authHeaders() });
    tbody.innerHTML = requests.length ? requests.map(r => `<tr><td><strong>${esc(r.company_name)}</strong></td><td>${esc(r.industry||'—')}</td><td>${esc(r.contact_name)}<br><small style="color:#999">${esc(r.contact_email)}</small></td><td>${esc(r.job_title)}</td><td style="color:var(--grey-mid);font-size:13px">${new Date(r.created_at).toLocaleDateString()}</td><td><span class="status-badge status-${r.status==='new'?'new':'active'}">${capitalize(r.status)}</span></td></tr>`).join('') : '<tr><td colspan="6" style="text-align:center;padding:20px;color:#999">No requests yet.</td></tr>';
  } catch(err) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:#999">Could not load requests.</td></tr>'; }
}

async function loadAdminEnquiries() {
  const tbody = document.getElementById('adminEnquiriesTable');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:#999">Loading...</td></tr>';
  try {
    const { enquiries } = await apiFetch('/admin/enquiries?limit=50', { headers: authHeaders() });
    tbody.innerHTML = enquiries.length ? enquiries.map(e => `<tr><td><strong>${esc(e.full_name)}</strong><br><small style="color:#999">${esc(e.email)}</small></td><td><span class="jlc-tag" style="font-size:11px">${esc(e.user_type||'General')}</span></td><td>${esc(e.subject)}</td><td style="color:var(--grey-mid);font-size:13px">${new Date(e.created_at).toLocaleDateString()}</td><td><span class="status-badge status-${e.status==='new'?'new':e.status==='replied'?'active':'closed'}">${capitalize(e.status)}</span></td></tr>`).join('') : '<tr><td colspan="5" style="text-align:center;padding:20px;color:#999">No enquiries yet.</td></tr>';
  } catch(err) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:#999">Could not load enquiries.</td></tr>'; }
}

function showAddJobModal() {
  const modal = document.getElementById('addJobModal');
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.innerHTML = `<div class="modal-box" onclick="event.stopPropagation()"><div class="modal-header"><h3>Add New Job Listing</h3><button onclick="closeModal()" class="modal-close">✕</button></div><form onsubmit="addNewJob(event)" class="modal-form"><div class="form-row"><div class="form-group"><label for="mJobTitle">Job Title *</label><input type="text" id="mJobTitle" required/></div><div class="form-group"><label for="mJobCompany">Company *</label><input type="text" id="mJobCompany" required/></div></div><div class="form-row"><div class="form-group"><label for="mJobLocation">Location *</label><input type="text" id="mJobLocation" required/></div><div class="form-group"><label for="mJobType">Type *</label><select id="mJobType" required><option>Full-time</option><option>Part-time</option><option>Contract</option><option>Remote</option></select></div></div><div class="form-row"><div class="form-group"><label for="mJobCategory">Category</label><input type="text" id="mJobCategory"/></div><div class="form-group"><label for="mJobExp">Experience</label><input type="text" id="mJobExp" placeholder="e.g. 3–5 years"/></div></div><div class="form-row"><div class="form-group"><label for="mJobSalary">Salary Display</label><input type="text" id="mJobSalary" placeholder="e.g. ₦400k–₦600k/mo"/></div><div class="form-group"><label for="mJobFeatured">Featured?</label><select id="mJobFeatured"><option value="false">No</option><option value="true">Yes</option></select></div></div><div class="form-group full"><label for="mJobDesc">Description *</label><textarea id="mJobDesc" rows="4" required></textarea></div><div class="modal-actions"><button type="button" class="btn-outline-blue" onclick="closeModal()">Cancel</button><button type="submit" class="btn-primary" id="addJobBtn">Add Job</button></div></form></div>`;
  modal.style.display = 'flex';
  setTimeout(() => document.getElementById('mJobTitle')?.focus(), 50);
}

async function addNewJob(e) {
  e.preventDefault();
  const btn = document.getElementById('addJobBtn');
  btn.textContent = 'Adding...'; btn.disabled = true;
  const title = document.getElementById('mJobTitle').value;
  const company = document.getElementById('mJobCompany').value;
  try {
    await apiFetch('/admin/jobs', { method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ title, company, location: document.getElementById('mJobLocation').value, job_type: document.getElementById('mJobType').value, category: document.getElementById('mJobCategory').value, experience: document.getElementById('mJobExp').value, salary_display: document.getElementById('mJobSalary').value, description: document.getElementById('mJobDesc').value, is_featured: document.getElementById('mJobFeatured').value==='true', logo_initials: company.substring(0,2).toUpperCase() })
    });
    closeModal();
    showToast(`Job "${esc(title)}" added!`, 'success');
    loadAdminJobs(); loadFeaturedJobs();
  } catch(err) { showToast(err.message||'Failed to add job', 'error'); btn.textContent = 'Add Job'; btn.disabled = false; }
}

function closeModal() {
  const m = document.getElementById('addJobModal');
  if (m) { m.style.display = 'none'; m.removeAttribute('role'); m.removeAttribute('aria-modal'); }
}

function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast' + (type ? ' ' + type : '');
  toast.classList.add('show');
  const duration = Math.max(3000, Math.min(msg.length * 60, 6000));
  setTimeout(() => toast.classList.remove('show'), duration);
}

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

document.addEventListener('DOMContentLoaded', () => {
  // Escape key closes modal
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  // Track dirty state on contact and employer forms
  document.addEventListener('input', (e) => {
    if (e.target.closest('.contact-form, .post-job-form')) formDirty = true;
  });

  loadFeaturedJobs();
  const token = getToken();
  if (token) {
    apiFetch('/auth/me', { headers: authHeaders() }).catch(() => clearToken());
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.style.animation = 'fadeUp 0.6s ease both'; observer.unobserve(e.target); } });
  }, { threshold: 0.1 });
  document.querySelectorAll('.service-card, .value-card, .package-card').forEach(el => observer.observe(el));
});
