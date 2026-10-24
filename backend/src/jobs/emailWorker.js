import { env } from '../config/env.js'
import { supabaseAdmin } from '../lib/supabase.js'

const labels = {
    reservation_confirmed: 'Reservation confirmed',
    reservation_modified: 'Reservation updated',
    reservation_cancelled: 'Reservation cancelled',
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;')
}

async function sendEmail(job) {
    const reservation = job.reservation
    const title = labels[job.notification_type]
    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from: env.EMAIL_FROM,
            to: [job.recipient_email],
            subject: `${title}: ${reservation.confirmation_number}`,
            html: `
                <h1>${escapeHtml(title)}</h1>
                <p>Hello ${escapeHtml(reservation.primary_guest_name)},</p>
                <p>Your reservation at <strong>${escapeHtml(reservation.hotel.name)}</strong> is ${escapeHtml(title.toLowerCase())}.</p>
                <p>Confirmation: <strong>${escapeHtml(reservation.confirmation_number)}</strong></p>
                <p>${escapeHtml(reservation.check_in)} to ${escapeHtml(reservation.check_out)}</p>
                <p>Total: ${escapeHtml(reservation.total_amount)} ${escapeHtml(reservation.currency)}</p>
            `,
        }),
    })

    if (!response.ok) {
        throw new Error(`Email provider returned HTTP ${response.status}`)
    }
}

export async function processEmailOutbox() {
    if (!supabaseAdmin || !env.RESEND_API_KEY || !env.EMAIL_FROM) return

    const { data: jobs, error } = await supabaseAdmin
        .from('notification_outbox')
        .select(`
            *,
            reservation:reservations(
                confirmation_number,
                primary_guest_name,
                check_in,
                check_out,
                total_amount,
                currency,
                hotel:hotels(name)
            )
        `)
        .in('status', ['pending', 'failed'])
        .lt('attempts', 3)
        .order('created_at')
        .limit(10)

    if (error) throw error

    for (const job of jobs) {
        try {
            await sendEmail(job)
            await supabaseAdmin
                .from('notification_outbox')
                .update({
                    status: 'sent',
                    attempts: job.attempts + 1,
                    last_error: null,
                    sent_at: new Date().toISOString(),
                })
                .eq('id', job.id)
        } catch (emailError) {
            await supabaseAdmin
                .from('notification_outbox')
                .update({
                    status: 'failed',
                    attempts: job.attempts + 1,
                    last_error: emailError.message.slice(0, 1000),
                })
                .eq('id', job.id)
        }
    }
}

export function startEmailWorker() {
    if (!supabaseAdmin || !env.RESEND_API_KEY || !env.EMAIL_FROM) return

    const run = () =>
        processEmailOutbox().catch((error) => {
            console.error('Email outbox failed', { message: error.message })
        })

    run()
    setInterval(run, 30000).unref()
}
