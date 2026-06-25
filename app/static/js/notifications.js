// EduPulse Ops — Notification Module
// Handles smtp/whatsapp connectors configuration, alert triggers, templates, and delivery history logs

import { state, authFetch, API_BASE } from './api.js';
import { showToast, escapeHtml } from './ui.js';

let notificationsActiveSubTab = 'connectors';

export async function loadNotificationsViewData() {
    showLoadingState();
    try {
        await Promise.all([
            loadNotificationConnectors(),
            loadNotificationRules(),
            loadNotificationLogs()
        ]);
    } catch (err) {
        console.error(err);
        showToast('Failed to load notifications hub data', 'error');
    } finally {
        hideLoadingState();
    }
}

function showLoadingState() {}
function hideLoadingState() {}

export async function loadNotificationConnectors() {
    try {
        const res = await authFetch(`${API_BASE}/notifications/connectors`);
        const data = await res.json();
        const connectors = data.items || [];
        
        // Populates Email Form
        const emailConn = connectors.find(c => c.name === 'email');
        if (emailConn) {
            document.getElementById('email-connector-toggle').checked = emailConn.is_enabled;
            const config = JSON.parse(emailConn.config || '{}');
            document.getElementById('email-smtp-server').value = config.smtp_server || '';
            document.getElementById('email-smtp-port').value = config.smtp_port || '';
            document.getElementById('email-sender-email').value = config.sender_email || '';
            document.getElementById('email-sender-name').value = config.sender_name || '';
            document.getElementById('email-smtp-username').value = config.smtp_username || '';
            document.getElementById('email-smtp-password').value = config.smtp_password || '';
            document.getElementById('email-use-tls').checked = !!config.use_tls;
        }
        
        // Populates WhatsApp Form
        const waConn = connectors.find(c => c.name === 'whatsapp');
        if (waConn) {
            document.getElementById('whatsapp-connector-toggle').checked = waConn.is_enabled;
            const config = JSON.parse(waConn.config || '{}');
            document.getElementById('whatsapp-api-url').value = config.api_url || '';
            document.getElementById('whatsapp-account-sid').value = config.account_sid || '';
            document.getElementById('whatsapp-auth-token').value = config.auth_token || '';
            document.getElementById('whatsapp-sender-number').value = config.sender_number || '';
        }
    } catch (err) {
        console.error('Error fetching connectors:', err);
    }
}

export async function loadNotificationRules() {
    try {
        const res = await authFetch(`${API_BASE}/notifications/rules`);
        const data = await res.json();
        const rules = data.items || [];
        
        const container = document.getElementById('notif-rules-list');
        if (!container) return;
        
        if (rules.length === 0) {
            container.innerHTML = `<div class="py-8 text-center text-slate-400">No rules configured.</div>`;
            return;
        }
        
        container.innerHTML = rules.map(rule => {
            const isFailedType = rule.event_type === 'assignment_failed';
            const thresholdHtml = isFailedType ? `
                <div class="w-full sm:w-1/3">
                    <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Passing Grade Threshold (%)</label>
                    <input type="number" id="rule-threshold-${rule.event_type}-${rule.connector_type}" value="${rule.passing_threshold || 50}" min="1" max="100"
                        class="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/20 text-xs font-semibold text-slate-800 outline-none transition-all">
                </div>
            ` : '';
            
            const eventLabel = rule.event_type === 'student_absent' ? 'Student Absent Alert' : 'Failed Assignment Alert';
            const channelIcon = rule.connector_type === 'email' ? '<i class="fas fa-envelope text-brand-teal mr-1"></i> Email' : '<i class="fab fa-whatsapp text-green-500 mr-1"></i> WhatsApp';
            
            const placeholdersHelp = rule.event_type === 'student_absent' ? 
                'Available: {student_name}, {date}' : 
                'Available: {student_name}, {assignment_title}, {score}, {max_points}, {passing_threshold}';

            return `
                <div class="py-6 flex flex-col md:flex-row md:items-start justify-between gap-6">
                    <div class="flex-1 space-y-4">
                        <div class="flex items-center justify-between">
                            <div>
                                <h3 class="text-sm font-bold text-slate-900">${eventLabel}</h3>
                                <span class="inline-flex items-center text-[10px] font-semibold text-slate-500 mt-0.5">${channelIcon}</span>
                            </div>
                            <label class="relative inline-flex items-center cursor-pointer select-none">
                                <input type="checkbox" id="rule-toggle-${rule.event_type}-${rule.connector_type}" ${rule.is_enabled ? 'checked' : ''} 
                                    onchange="toggleRule('${rule.event_type}', '${rule.connector_type}')" class="sr-only peer">
                                <div class="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-teal"></div>
                            </label>
                        </div>
                        
                        <div class="flex flex-col sm:flex-row gap-4 items-end">
                            <div class="flex-1">
                                <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Message Template</label>
                                <textarea id="rule-template-${rule.event_type}-${rule.connector_type}" rows="2"
                                    class="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 focus:border-brand-teal focus:ring-1 focus:ring-brand-teal/20 text-xs font-medium text-slate-800 outline-none transition-all resize-none">${rule.template}</textarea>
                                <span class="text-[10px] text-slate-400 font-medium">${placeholdersHelp}</span>
                            </div>
                            ${thresholdHtml}
                        </div>
                    </div>
                    <div class="md:self-end">
                        <button type="button" onclick="saveRuleSettings('${rule.event_type}', '${rule.connector_type}')"
                            class="w-full md:w-auto px-4 py-2 bg-brand-teal hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm">
                            <i class="fas fa-save"></i> Save Rule
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error('Error fetching rules:', err);
    }
}

export async function loadNotificationLogs() {
    const tbody = document.getElementById('notif-logs-tbody');
    const footer = document.getElementById('notif-logs-footer');
    if (!tbody) return;
    
    tbody.innerHTML = `
        <tr>
            <td colspan="8" class="py-8 text-center text-slate-400">
                <i class="fas fa-circle-notch fa-spin text-brand-teal mr-2"></i> Loading delivery logs...
            </td>
        </tr>`;
        
    try {
        const res = await authFetch(`${API_BASE}/notifications/logs?limit=50`);
        const data = await res.json();
        const logs = data.items || [];
        
        if (logs.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="py-8 text-center text-slate-400 font-medium">
                        <i class="fas fa-inbox text-lg block mb-1"></i> No notifications have been sent yet.
                    </td>
                </tr>`;
            if (footer) footer.innerText = 'Showing 0 logs';
            return;
        }
        
        tbody.innerHTML = logs.map(log => {
            const formattedTime = new Date(log.created_at).toLocaleString();
            
            const eventBadge = log.event_type === 'student_absent' ? 
                '<span class="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full text-[10px] font-bold">Absent Alert</span>' :
                '<span class="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-[10px] font-bold">Academic Alert</span>';
                
            const channelBadge = log.channel === 'EMAIL' ?
                '<span class="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[10px] font-bold"><i class="fas fa-envelope mr-1"></i>Email</span>' :
                '<span class="px-2 py-0.5 bg-green-50 text-green-700 rounded-full text-[10px] font-bold"><i class="fab fa-whatsapp mr-1"></i>WhatsApp</span>';
                
            const statusBadge = log.status === 'SENT' ?
                '<span class="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold">Sent</span>' :
                `<span class="px-2 py-0.5 bg-rose-50 text-rose-700 rounded-full text-[10px] font-bold" title="${escapeHtml(log.error_message || '')}">Failed</span>`;
                
            const retryBtn = log.status === 'FAILED' ?
                `<button type="button" onclick="retryNotificationLog(${log.id})" class="px-2.5 py-1 bg-brand-teal hover:bg-teal-700 text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 shadow-sm"><i class="fas fa-rotate"></i> Retry</button>` :
                '<span class="text-slate-400 font-semibold text-[10px]">&mdash;</span>';

            return `
                <tr class="hover:bg-slate-50/50 transition-colors">
                    <td class="py-3.5 px-4 font-semibold text-slate-500 whitespace-nowrap">${formattedTime}</td>
                    <td class="py-3.5 px-4">${eventBadge}</td>
                    <td class="py-3.5 px-4">${channelBadge}</td>
                    <td class="py-3.5 px-4 font-bold text-slate-800">${log.student_name}</td>
                    <td class="py-3.5 px-4 font-semibold text-slate-600">${log.parent_contact}</td>
                    <td class="py-3.5 px-4 text-slate-600 max-w-xs truncate" title="${escapeHtml(log.message_body)}">${log.message_body}</td>
                    <td class="py-3.5 px-4 text-center">${statusBadge}</td>
                    <td class="py-3.5 px-4">${retryBtn}</td>
                </tr>
            `;
        }).join('');
        
        if (footer) footer.innerText = `Showing ${logs.length} log entries`;
    } catch (err) {
        console.error('Error fetching logs:', err);
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="py-8 text-center text-rose-500 font-medium">
                    <i class="fas fa-circle-exclamation text-lg block mb-1"></i> Failed to retrieve delivery history logs.
                </td>
            </tr>`;
    }
}

export function switchNotificationSubTab(subTab) {
    notificationsActiveSubTab = subTab;
    const tabs = ['connectors', 'rules', 'logs'];
    
    tabs.forEach(t => {
        const btn = document.getElementById(`notif-tab-${t}`);
        const panel = document.getElementById(`notif-panel-${t}`);
        
        if (btn && panel) {
            if (t === subTab) {
                panel.classList.remove('hidden');
                btn.classList.add('border-brand-teal', 'text-brand-teal');
                btn.classList.remove('border-transparent', 'text-slate-500', 'hover:text-slate-700', 'hover:border-slate-300');
            } else {
                panel.classList.add('hidden');
                btn.classList.remove('border-brand-teal', 'text-brand-teal');
                btn.classList.add('border-transparent', 'text-slate-500', 'hover:text-slate-700', 'hover:border-slate-300');
            }
        }
    });
}

export async function toggleConnector(name) {
    const toggle = document.getElementById(`${name}-connector-toggle`);
    if (!toggle) return;
    
    try {
        const res = await authFetch(`${API_BASE}/notifications/connectors/${name}`, {
            method: 'PUT',
            body: JSON.stringify({ is_enabled: toggle.checked })
        });
        if (!res.ok) throw new Error('Update failed');
        showToast(`${name.toUpperCase()} connector ${toggle.checked ? 'enabled' : 'disabled'}`, 'success');
    } catch (err) {
        console.error(err);
        toggle.checked = !toggle.checked;
        showToast(`Failed to toggle connector`, 'error');
    }
}

export async function saveConnectorSettings(name) {
    let config = {};
    if (name === 'email') {
        config = {
            smtp_server: document.getElementById('email-smtp-server').value,
            smtp_port: parseInt(document.getElementById('email-smtp-port').value || '587'),
            sender_email: document.getElementById('email-sender-email').value,
            sender_name: document.getElementById('email-sender-name').value,
            smtp_username: document.getElementById('email-smtp-username').value,
            smtp_password: document.getElementById('email-smtp-password').value,
            use_tls: document.getElementById('email-use-tls').checked
        };
    } else if (name === 'whatsapp') {
        config = {
            api_url: document.getElementById('whatsapp-api-url').value,
            account_sid: document.getElementById('whatsapp-account-sid').value,
            auth_token: document.getElementById('whatsapp-auth-token').value,
            sender_number: document.getElementById('whatsapp-sender-number').value
        };
    }
    
    try {
        const res = await authFetch(`${API_BASE}/notifications/connectors/${name}`, {
            method: 'PUT',
            body: JSON.stringify({ config: JSON.stringify(config) })
        });
        if (!res.ok) throw new Error('Save failed');
        showToast(`${name.toUpperCase()} configurations saved successfully`, 'success');
    } catch (err) {
        console.error(err);
        showToast(`Failed to save settings`, 'error');
    }
}

export async function toggleRule(eventType, connectorType) {
    const toggle = document.getElementById(`rule-toggle-${eventType}-${connectorType}`);
    if (!toggle) return;
    
    try {
        const res = await authFetch(`${API_BASE}/notifications/rules/${eventType}/${connectorType}`, {
            method: 'PUT',
            body: JSON.stringify({ is_enabled: toggle.checked })
        });
        if (!res.ok) throw new Error('Toggle failed');
        showToast(`Rule updated successfully`, 'success');
    } catch (err) {
        console.error(err);
        toggle.checked = !toggle.checked;
        showToast(`Failed to toggle rule`, 'error');
    }
}

export async function saveRuleSettings(eventType, connectorType) {
    const template = document.getElementById(`rule-template-${eventType}-${connectorType}`).value;
    const thresholdInput = document.getElementById(`rule-threshold-${eventType}-${connectorType}`);
    const passingThreshold = thresholdInput ? parseFloat(thresholdInput.value || '50') : null;
    
    try {
        const res = await authFetch(`${API_BASE}/notifications/rules/${eventType}/${connectorType}`, {
            method: 'PUT',
            body: JSON.stringify({ template, passing_threshold: passingThreshold })
        });
        if (!res.ok) throw new Error('Save failed');
        showToast(`Rule template and settings saved`, 'success');
    } catch (err) {
        console.error(err);
        showToast(`Failed to save rule settings`, 'error');
    }
}

export function openTestConnectorModal(name) {
    const modal = document.getElementById('edit-modal');
    const content = document.getElementById('edit-modal-content');
    if (!modal || !content) return;
    
    const defaultRecipient = name === 'email' ? 'parent@example.com' : '+60123456789';
    const modalHtml = `
        <div class="p-6 border-b border-slate-100 flex items-center justify-between">
            <h3 class="text-lg font-bold text-slate-900 flex items-center gap-2">
                <i class="fas fa-paper-plane text-brand-teal"></i>
                Test ${name.toUpperCase()} Connection
            </h3>
            <button onclick="closeEditModal()" class="text-slate-400 hover:text-slate-600 transition-colors">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <form onsubmit="submitTestConnector(event, '${name}')" class="p-6 space-y-4">
            <div>
                <label for="test-notif-recipient" class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Recipient Address / Phone</label>
                <input type="text" id="test-notif-recipient" value="${defaultRecipient}" required
                    class="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white rounded-xl border border-slate-200 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 text-sm font-medium text-slate-800 outline-none transition-all">
            </div>
            <div>
                <label for="test-notif-message" class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Test Message</label>
                <textarea id="test-notif-message" rows="3" required
                    class="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white rounded-xl border border-slate-200 focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 text-sm font-medium text-slate-800 outline-none transition-all resize-none">Hello, this is a test notification message from EduPulse.</textarea>
            </div>
            <div class="flex gap-3 pt-2">
                <button type="button" onclick="closeEditModal()"
                    class="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold text-sm transition-all text-center cursor-pointer">
                    Cancel
                </button>
                <button type="submit" id="test-notif-submit-btn"
                    class="flex-1 py-3 bg-brand-teal hover:bg-teal-700 text-white rounded-xl font-semibold text-sm shadow-md shadow-brand-teal/10 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer">
                    Send Test Message
                </button>
            </div>
        </form>
    `;
    
    content.innerHTML = modalHtml;
    modal.classList.remove('hidden');
    setTimeout(() => {
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
    }, 10);
}

export async function submitTestConnector(e, name) {
    e.preventDefault();
    const submitBtn = document.getElementById('test-notif-submit-btn');
    const recipient = document.getElementById('test-notif-recipient').value;
    const message = document.getElementById('test-notif-message').value;
    
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin mr-2"></i> Sending...';
    }
    
    try {
        const res = await authFetch(`${API_BASE}/notifications/connectors/${name}/test`, {
            method: 'POST',
            body: JSON.stringify({ recipient, message })
        });
        const data = await res.json();
        
        if (res.ok) {
            showToast(`Test message successfully routed.`, 'success');
            closeEditModal();
        } else {
            throw new Error(data.detail || 'Test failed');
        }
    } catch (err) {
        console.error(err);
        showToast(`Test connection failed: ${err.message}`, 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Send Test Message';
        }
    }
}

export async function retryNotificationLog(logId) {
    showToast('Retrying notification...', 'info');
    try {
        const res = await authFetch(`${API_BASE}/notifications/logs/${logId}/retry`, {
            method: 'POST'
        });
        const data = await res.json();
        if (res.ok) {
            showToast('Notification successfully re-sent!', 'success');
            loadNotificationLogs();
        } else {
            throw new Error(data.detail || 'Retry failed');
        }
    } catch (err) {
        console.error(err);
        showToast(`Retry failed: ${err.message}`, 'error');
        loadNotificationLogs();
    }
}

// Bind to window for HTML events compatibility
window.switchNotificationSubTab = switchNotificationSubTab;
window.toggleConnector = toggleConnector;
window.saveConnectorSettings = saveConnectorSettings;
window.toggleRule = toggleRule;
window.saveRuleSettings = saveRuleSettings;
window.openTestConnectorModal = openTestConnectorModal;
window.submitTestConnector = submitTestConnector;
window.retryNotificationLog = retryNotificationLog;
window.loadNotificationLogs = loadNotificationLogs;
window.loadNotificationsViewData = loadNotificationsViewData;
