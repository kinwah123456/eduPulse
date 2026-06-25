// EduPulse Ops — UI Module
// Shared toast notifications, HTML escaping, date formatting, and common UI helpers

/** Display elegant toast notifications */
export function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast-slide-in flex items-center gap-3 px-4 py-3 bg-white text-slate-800 rounded-xl shadow-lg border border-slate-100 max-w-sm pointer-events-auto transition-all duration-300`;
    
    const iconBg = type === 'success' ? 'bg-teal-50 text-brand-teal' : 'bg-rose-50 text-rose-500';
    const icon = type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation';
    
    toast.innerHTML = `
        <div class="p-2 rounded-lg ${iconBg} shrink-0">
            <i class="fas ${icon} text-sm"></i>
        </div>
        <div class="flex-1 text-xs font-semibold pr-2">${message}</div>
        <button class="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer text-xs" onclick="this.parentElement.remove()">
            <i class="fas fa-xmark"></i>
        </button>
    `;

    container.appendChild(toast);

    // Auto-remove after 4 seconds
    setTimeout(() => {
        toast.classList.remove('toast-slide-in');
        toast.classList.add('toast-slide-out');
        setTimeout(() => {
            toast.remove();
        }, 250);
    }, 4000);
}

/** Escape HTML characters to prevent XSS */
export function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/** Format today's date for the header badge */
export function formatTodayDate() {
    const options = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
    return new Date().toLocaleDateString('en-MY', options);
}

/** Convert "HH:MM" 24h string to 12h AM/PM display */
export function formatTime12h(timeStr) {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

/** Get current time as "HH:MM" in 24h format */
export function getCurrentTime24h() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

/** Get a time-aware greeting string */
export function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
}
