/**
 * Enhanced Notification Email Template
 * Sent when users receive in-app notifications (if email notifications are enabled)
 * Matches the style of eventRegistration template for consistency
 */

const notificationEmailTemplate = (username, notification) => {
  const appName = process.env.APP_NAME || 'EventHub';
  const frontendUrl = process.env.WEBSITE_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
  const notificationsUrl = `${frontendUrl}/notifications`;
  
  const { type, message, title, data, priority } = notification;
  
  // Define colors, icons, gradients, and action texts based on notification type
  const typeConfig = {
    // Event lifecycle
    event_created: { color: '#10b981', gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', icon: '🎉', label: 'New Event', actionText: 'View Event' },
    event_updated: { color: '#3b82f6', gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', icon: '📝', label: 'Event Updated', actionText: 'View Changes' },
    event_deleted: { color: '#ef4444', gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', icon: '🗑️', label: 'Event Deleted', actionText: 'View Details' },
    event_cancelled: { color: '#ef4444', gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', icon: '❌', label: 'Event Cancelled', actionText: 'View Details' },
    event_postponed: { color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', icon: '⏰', label: 'Event Postponed', actionText: 'View New Date' },
    venue_changed: { color: '#8b5cf6', gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', icon: '📍', label: 'Venue Changed', actionText: 'View Location' },
    
    // Registration status
    registered: { color: '#10b981', gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', icon: '✅', label: 'Registration Confirmed', actionText: 'View Registration' },
    unregistered: { color: '#6b7280', gradient: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)', icon: '👋', label: 'Unregistered', actionText: 'Browse Events' },
    registration_approved: { color: '#10b981', gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', icon: '✅', label: 'Registration Approved', actionText: 'View QR Code' },
    registration_rejected: { color: '#ef4444', gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', icon: '❌', label: 'Registration Rejected', actionText: 'View Details' },
    registration_pending: { color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', icon: '⏳', label: 'Registration Pending', actionText: 'Check Status' },
    
    // Waitlist
    waiting_list: { color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', icon: '📋', label: 'Waiting List', actionText: 'Check Position' },
    waitlist: { color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', icon: '📋', label: 'Added to Waitlist', actionText: 'Check Position' },
    waitlist_added: { color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', icon: '📋', label: 'Added to Waitlist', actionText: 'Check Position' },
    waitlist_promoted: { color: '#10b981', gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', icon: '🎊', label: 'Promoted from Waitlist!', actionText: 'View Registration' },
    
    // Reminders
    reminder_24h: { color: '#3b82f6', gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', icon: '🔔', label: 'Event Tomorrow!', actionText: 'View Event' },
    reminder_1h: { color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', icon: '⏰', label: 'Event Starting Soon!', actionText: 'View Event' },
    
    // Capacity
    capacity_alert: { color: '#ef4444', gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', icon: '⚠️', label: 'Capacity Alert', actionText: 'View Event' },
    spot_available: { color: '#10b981', gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', icon: '🎫', label: 'Spot Available!', actionText: 'Register Now' },
    
    // Social
    comment_added: { color: '#8b5cf6', gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', icon: '💬', label: 'New Comment', actionText: 'View Comment' },
    comment_reply: { color: '#8b5cf6', gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', icon: '↩️', label: 'Comment Reply', actionText: 'View Reply' },
    friend_registered: { color: '#ec4899', gradient: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)', icon: '👥', label: 'Friend Activity', actionText: 'View Event' },
    
    // Announcements
    announcement: { color: '#667eea', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', icon: '📢', label: 'Announcement', actionText: 'Read More' },
    custom_announcement: { color: '#667eea', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', icon: '📢', label: 'Announcement', actionText: 'Read More' },
    
    // Sub-events
    sub_event_created: { color: '#10b981', gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', icon: '➕', label: 'New Sub-Event', actionText: 'View Sub-Event' },
    sub_event_updated: { color: '#3b82f6', gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', icon: '📝', label: 'Sub-Event Updated', actionText: 'View Changes' },
    sub_event_deleted: { color: '#ef4444', gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', icon: '🗑️', label: 'Sub-Event Deleted', actionText: 'View Details' },
    
    // Admin/Organizer
    new_waitlist_entry: { color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', icon: '📋', label: 'New Waitlist Entry', actionText: 'Review Request' },
    trending_event: { color: '#ec4899', gradient: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)', icon: '🔥', label: 'Trending Event', actionText: 'View Event' },
    
    // Team notifications
    team_invitation: { color: '#8b5cf6', gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', icon: '👥', label: 'Team Invitation', actionText: 'View Invitation' },
    team_joined: { color: '#10b981', gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', icon: '🤝', label: 'Joined Team', actionText: 'View Team' },
    team_removed: { color: '#ef4444', gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', icon: '👤', label: 'Removed from Team', actionText: 'View Details' },
  };
  
  const config = typeConfig[type] || { 
    color: '#667eea', 
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
    icon: '📬', 
    label: 'Notification',
    actionText: 'View in EventHub'
  };
  
  // Priority badge with enhanced styling
  const priorityBadge = priority === 'urgent' || priority === 'critical' 
    ? `<span style="display: inline-block; background-color: #ef4444; color: white; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: uppercase; margin-left: 10px;">🚨 URGENT</span>`
    : priority === 'high'
    ? `<span style="display: inline-block; background-color: #f59e0b; color: white; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: uppercase; margin-left: 10px;">⚡ HIGH PRIORITY</span>`
    : '';
  
  // Build event URL
  const eventId = data?.eventId;
  const eventUrl = eventId ? `${frontendUrl}/events/${eventId}` : notificationsUrl;
  
  // Format event date if available
  let formattedDate = '';
  if (data?.eventDate) {
    try {
      formattedDate = new Date(data.eventDate).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch (e) {
      formattedDate = data.eventDate;
    }
  }
  
  // Build event details card
  const hasEventDetails = data?.eventTitle || data?.eventDate || data?.eventTime || data?.eventVenue;
  const eventDetailsHtml = hasEventDetails ? `
    <div style="background: linear-gradient(135deg, #f5f7fa 0%, #e4e8eb 100%); border-radius: 12px; padding: 20px 25px; margin: 25px 0; border-left: 4px solid ${config.color};">
      ${data?.eventTitle ? `<h3 style="margin: 0 0 15px; color: #333333; font-size: 18px; font-weight: 600;">📌 ${data.eventTitle}</h3>` : ''}
      <table style="width: 100%; border-collapse: collapse;">
        ${formattedDate ? `
        <tr>
          <td style="padding: 6px 0; color: #666666; font-size: 14px; width: 30px; vertical-align: top;">📅</td>
          <td style="padding: 6px 0; color: #666666; font-size: 14px;"><strong>Date:</strong> ${formattedDate}</td>
        </tr>` : ''}
        ${data?.eventTime ? `
        <tr>
          <td style="padding: 6px 0; color: #666666; font-size: 14px; vertical-align: top;">🕐</td>
          <td style="padding: 6px 0; color: #666666; font-size: 14px;"><strong>Time:</strong> ${data.eventTime}</td>
        </tr>` : ''}
        ${data?.eventVenue ? `
        <tr>
          <td style="padding: 6px 0; color: #666666; font-size: 14px; vertical-align: top;">📍</td>
          <td style="padding: 6px 0; color: #666666; font-size: 14px;"><strong>Venue:</strong> ${data.eventVenue}</td>
        </tr>` : ''}
        ${data?.registrationId ? `
        <tr>
          <td style="padding: 6px 0; color: #666666; font-size: 14px; vertical-align: top;">🎫</td>
          <td style="padding: 6px 0; color: #666666; font-size: 14px;"><strong>Registration ID:</strong> ${String(data.registrationId).substring(0, 8).toUpperCase()}...</td>
        </tr>` : ''}
        ${data?.position ? `
        <tr>
          <td style="padding: 6px 0; color: #666666; font-size: 14px; vertical-align: top;">📊</td>
          <td style="padding: 6px 0; color: #666666; font-size: 14px;"><strong>Waitlist Position:</strong> #${data.position}</td>
        </tr>` : ''}
        ${data?.teamName ? `
        <tr>
          <td style="padding: 6px 0; color: #666666; font-size: 14px; vertical-align: top;">👥</td>
          <td style="padding: 6px 0; color: #666666; font-size: 14px;"><strong>Team:</strong> ${data.teamName}</td>
        </tr>` : ''}
      </table>
    </div>
  ` : '';
  
  // Rejection reason box
  const rejectionReasonHtml = (type === 'registration_rejected' && data?.reason) ? `
    <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 15px 20px; margin: 20px 0;">
      <p style="margin: 0; color: #991b1b; font-size: 14px;">
        <strong>📝 Reason:</strong> ${data.reason}
      </p>
    </div>
  ` : '';
  
  // QR code reminder for approved registrations
  const qrReminderHtml = (type === 'registration_approved' || type === 'waitlist_promoted') ? `
    <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 15px 20px; margin: 20px 0;">
      <p style="margin: 0; color: #065f46; font-size: 14px;">
        <strong>📱 Important:</strong> Your QR code is ready! Show it at the event for quick check-in.
      </p>
    </div>
  ` : '';
  
  // Generate subject line
  const subject = title || `${config.icon} ${config.label}${data?.eventTitle ? `: ${data.eventTitle}` : ''}`;
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${config.label}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);">
          
          <!-- Header with Gradient -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; background: ${config.gradient}; border-radius: 16px 16px 0 0;">
              <h1 style="margin: 0 0 10px; color: #ffffff; font-size: 24px; font-weight: 700;">${appName}</h1>
            </td>
          </tr>
          
          <!-- Icon Badge -->
          <tr>
            <td style="text-align: center; padding: 0;">
              <div style="display: inline-block; width: 80px; height: 80px; background: ${config.gradient}; border-radius: 50%; margin-top: -40px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
                <span style="font-size: 36px; line-height: 80px;">${config.icon}</span>
              </div>
            </td>
          </tr>
          
          <!-- Title -->
          <tr>
            <td style="padding: 20px 40px 10px; text-align: center;">
              <h2 style="margin: 0; color: #333333; font-size: 22px; font-weight: 600;">
                ${config.label}${priorityBadge}
              </h2>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 10px 40px 30px;">
              <p style="margin: 0 0 20px; color: #666666; font-size: 16px; line-height: 1.6;">
                Hello <strong style="color: #333;">${username}</strong>,
              </p>
              
              <!-- Main Message Box -->
              <div style="background-color: #f8f9fa; border-left: 4px solid ${config.color}; padding: 18px 22px; margin: 20px 0; border-radius: 0 8px 8px 0;">
                <p style="margin: 0; color: #333333; font-size: 16px; line-height: 1.7;">
                  ${message}
                </p>
              </div>
              
              ${eventDetailsHtml}
              ${rejectionReasonHtml}
              ${qrReminderHtml}
              
              <!-- CTA Button -->
              <div style="text-align: center; margin: 30px 0 20px;">
                <a href="${eventUrl}" style="display: inline-block; padding: 14px 40px; background: ${config.gradient}; color: #ffffff; text-decoration: none; border-radius: 30px; font-size: 15px; font-weight: 600; box-shadow: 0 4px 15px ${config.color}40;">
                  ${config.actionText}
                </a>
              </div>
              
              <p style="margin: 20px 0 0; color: #999999; font-size: 13px; line-height: 1.6; text-align: center;">
                If the button doesn't work, copy and paste this link:<br>
                <a href="${eventUrl}" style="color: ${config.color}; word-break: break-all;">${eventUrl}</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #2c3e50; border-radius: 0 0 16px 16px; text-align: center;">
              <p style="margin: 0 0 15px; color: #3498db; font-size: 13px; font-weight: 600;">
                EventHub - Event Management System
              </p>
              <p style="margin: 0 0 5px; color: #ecf0f1; font-size: 11px;">
                Developed by Mokshyagna Yadav
              </p>
              <p style="margin: 0 0 5px; color: #bdc3c7; font-size: 11px;">
                Department of Computer Science and Engineering
              </p>
              <p style="margin: 0 0 20px; color: #bdc3c7; font-size: 11px;">
                DVR & Dr. HS MIC College of Technology
              </p>
              <p style="margin: 0; color: #95a5a6; font-size: 11px;">
                © ${new Date().getFullYear()} ${appName}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
  
  // Plain text version with all event details
  const text = `
${config.icon} ${config.label}

Hello ${username},

${message}

${data?.eventTitle ? `Event: ${data.eventTitle}` : ''}
${formattedDate ? `Date: ${formattedDate}` : ''}
${data?.eventTime ? `Time: ${data.eventTime}` : ''}
${data?.eventVenue ? `Venue: ${data.eventVenue}` : ''}
${data?.registrationId ? `Registration ID: ${String(data.registrationId).substring(0, 8).toUpperCase()}` : ''}
${data?.position ? `Waitlist Position: #${data.position}` : ''}
${data?.teamName ? `Team: ${data.teamName}` : ''}
${data?.reason ? `Reason: ${data.reason}` : ''}

${config.actionText}: ${eventUrl}

---
You're receiving this because you have email notifications enabled.
To manage your notification preferences, visit your profile settings.

© ${new Date().getFullYear()} ${appName}. All rights reserved.

EventHub - Event Management System
Developed by Mokshyagna Yadav
Department of Computer Science and Engineering
DVR & Dr. HS MIC College of Technology
  `.trim();
  
  return { subject, html, text };
};

export default notificationEmailTemplate;
