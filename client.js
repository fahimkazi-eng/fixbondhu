const services = [
  { icon: '⌁', name: 'AC & appliances', query: 'AC repair', detail: 'Repair, servicing & installation' },
  { icon: 'ϟ', name: 'Electrical', query: 'বাসার ইলেকট্রিশিয়ান', detail: 'Wiring, fans, lights & safety' },
  { icon: '⌇', name: 'Plumbing', query: 'plumber দরকার', detail: 'Leaks, fittings & water lines' },
  { icon: '▧', name: 'Cleaning', query: 'home cleaning', detail: 'Home and deep cleaning' },
  { icon: '⌂', name: 'Home repairs', query: 'home repair', detail: 'Small jobs around the home' },
  { icon: '◈', name: 'Beauty & care', query: 'beauty service', detail: 'At-home personal care' },
];
const categoryGrid = document.querySelector('#category-grid');
categoryGrid.innerHTML = services.map(s => `<button class="category" data-query="${s.query}"><span class="category-icon">${s.icon}</span><strong>${s.name}</strong><small>${s.detail}</small></button>`).join('');

const modal = document.querySelector('#modal');
const content = document.querySelector('#modal-content');
const search = document.querySelector('#service-search');
const suggestions = document.querySelector('#search-suggestions');
const showToast = message => {
  const toast = document.createElement('div'); toast.className = 'toast'; toast.textContent = message; document.body.append(toast);
  setTimeout(() => { toast.style.opacity = 0; setTimeout(() => toast.remove(), 350); }, 3500);
};
const openModal = kind => {
  const views = {
    signin: `<div class="modal-content"><h2>Welcome back</h2><p>Sign in to manage your service requests, messages, and payments.</p><form data-form="signin"><label>Mobile number</label><input required inputmode="numeric" placeholder="01XXXXXXXXX"><label>Password</label><input required type="password" placeholder="Your password"><button class="solid-button">Sign in securely</button></form></div>`,
    signup: `<div class="modal-content"><h2>Create your account</h2><p>Start with your mobile number. We’ll verify it before you can book.</p><form data-form="signup"><label>Full name</label><input required placeholder="Your name"><label>Mobile number</label><input required inputmode="numeric" placeholder="01XXXXXXXXX"><label>Password</label><input required type="password" minlength="8" placeholder="At least 8 characters"><button class="solid-button">Create account</button></form></div>`,
    provider: `<div class="modal-content"><h2>Grow with FixBondhu</h2><p>Professional onboarding includes service-area selection and verification before you receive customer requests.</p><form data-form="provider"><label>Business or professional name</label><input required placeholder="Your name or business"><label>Mobile number</label><input required inputmode="numeric" placeholder="01XXXXXXXXX"><label>Primary service</label><select required><option value="">Select a service</option>${services.map(s=>`<option>${s.name}</option>`).join('')}</select><button class="solid-button">Start professional onboarding</button></form></div>`,
    location: `<div class="modal-content"><h2>Where do you need service?</h2><p>We use your selected address only to check real provider coverage and service availability.</p><form data-form="location"><label>Area / neighbourhood</label><input required placeholder="e.g. Dhanmondi"><label>City</label><select required><option value="">Choose a city</option><option>Dhaka</option><option>Chattogram</option><option>Khulna</option><option>Rajshahi</option></select><button class="solid-button">Check service availability</button></form></div>`,
    request: `<div class="modal-content"><h2>Start a service request</h2><p>You’ll choose a location and describe the job. A booking is created only after a provider accepts.</p><form data-form="request"><label>What do you need help with?</label><input required value="${search.value}" placeholder="e.g. AC is not cooling"><label>Tell the professional more</label><textarea placeholder="Include the problem, preferred time, or anything important."></textarea><button class="solid-button">Continue to location</button></form></div>`
  };
  content.innerHTML = views[kind]; modal.showModal();
};
document.querySelectorAll('[data-open]').forEach(el => el.addEventListener('click', () => openModal(el.dataset.open)));
document.querySelector('.modal-close').addEventListener('click', () => modal.close());
modal.addEventListener('click', e => { if (e.target === modal) modal.close(); });
document.addEventListener('submit', event => {
  const form = event.target; if (!form.dataset.form) return; event.preventDefault();
  const type = form.dataset.form;
  if (type === 'request') { modal.close(); openModal('location'); return; }
  const messages = { signin: 'Demo sign-in completed. Connect this form to your secure auth API.', signup: 'Account details captured. Phone verification is the next real production step.', provider: 'Your professional onboarding request has been saved for verification review.', location: 'Location saved. We’ll show providers only when verified coverage exists.' };
  content.innerHTML = `<div class="modal-content"><h2>Thank you</h2><div class="success-box">${messages[type]}</div><button class="solid-button" onclick="document.querySelector('#modal').close()">Done</button></div>`;
});
function renderSuggestions() {
  const query = search.value.trim().toLowerCase();
  if (!query) { suggestions.hidden = true; return; }
  const matches = services.filter(s => [s.name, s.query, s.detail].join(' ').toLowerCase().includes(query) || query.includes('fan') && s.name === 'Electrical');
  suggestions.innerHTML = (matches.length ? matches : services.slice(0, 3)).map(s => `<button data-fill="${s.query}"><strong>${s.name}</strong> <small>— ${s.detail}</small></button>`).join('');
  suggestions.hidden = false;
}
search.addEventListener('input', renderSuggestions);
suggestions.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; search.value = b.dataset.fill; suggestions.hidden = true; openModal('request'); });
document.querySelector('#search-button').addEventListener('click', () => openModal('request'));
document.querySelector('#request-button').addEventListener('click', () => openModal('request'));
document.querySelector('#location-button').addEventListener('click', () => openModal('location'));
categoryGrid.addEventListener('click', e => { const button = e.target.closest('.category'); if (!button) return; search.value = button.dataset.query; openModal('request'); });
document.querySelectorAll('.quick-search button').forEach(b => b.addEventListener('click', () => { search.value = b.textContent; openModal('request'); }));
document.querySelector('#waitlist-form').addEventListener('submit', e => { e.preventDefault(); const n = document.querySelector('#waitlist-phone'); if (n.value.length < 10) { showToast('Please enter a valid 10-digit Bangladeshi mobile number.'); return; } n.value = ''; document.querySelector('#waitlist-status').textContent = 'You’re on the update list. We’ll contact you when service reaches your area.'; showToast('Thanks — we’ll keep you updated.'); });
document.querySelector('.announcement button').addEventListener('click', e => e.currentTarget.parentElement.remove());
