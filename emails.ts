/**
 * Local email templates used in place of a third-party templating service.
 * Each builder returns a subject plus plain-text and HTML bodies that can be
 * handed directly to Amazon SES.
 */

/** The rendered pieces of an email message. */
export interface EmailContent {
  subject: string
  text: string
  html: string
}

/** Inputs for the customer tracking email. */
export interface TrackingEmailOptions {
  toLine1: string
  trackingNumber: string
  trackUrl: string
  uspsTracking: boolean
}

/** HTML entity replacements used by `escapeHtml`. */
const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}

/**
 * Escape a value for safe interpolation into HTML.
 * @param value raw value, potentially containing user-provided text
 * @returns HTML-escaped value
 */
const escapeHtml = (value: string): string =>
  String(value).replace(/[&<>"']/g, char => HTML_ESCAPES[char] ?? char)

/**
 * Wrap email body content in a minimal, table-based layout that renders
 * consistently across email clients.
 * @param content heading and body HTML
 * @returns complete HTML document
 */
const layout = ({ heading, body }: { heading: string; body: string }): string => `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  </head>
  <body style="margin: 0; padding: 0; background-color: #f2f2f2; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.5;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f2f2f2;">
      <tr>
        <td align="center" style="padding: 24px 12px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #ffffff; border-radius: 4px; overflow: hidden;">
            <tr>
              <td style="background-color: #0a3161; padding: 24px; text-align: center;">
                <h1 style="margin: 0; font-size: 22px; color: #ffffff;">${escapeHtml(heading)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding: 24px; color: #222222; font-size: 16px;">
                ${body}
              </td>
            </tr>
            <tr>
              <td style="padding: 16px 24px; color: #888888; font-size: 12px; text-align: center;">
                Mail a PDF Online
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`

/**
 * Build the customer email containing their mailing/tracking information.
 * @param options tracking details to include in the email
 * @returns the rendered subject, text, and HTML
 */
export const buildTrackingEmail = ({
  toLine1,
  trackingNumber,
  trackUrl,
  uspsTracking
}: TrackingEmailOptions): EmailContent => {
  const subject = uspsTracking
    ? 'Your document has been mailed (USPS tracking number included)'
    : 'Your document has been mailed'

  const textLines = ['Your document is on its way.', '', 'We mailed your document to:', toLine1, '']
  const htmlParts = [
    '<p style="margin: 0 0 16px;">Your document is on its way.</p>',
    '<p style="margin: 0 0 4px;">We mailed your document to:</p>',
    `<p style="margin: 0 0 16px;">${escapeHtml(toLine1)}</p>`
  ]

  if (uspsTracking) {
    textLines.push('It was sent with USPS tracking. Your tracking number is:', trackingNumber, '')
    htmlParts.push(
      '<p style="margin: 0 0 4px;">It was sent with USPS tracking. Your tracking number is:</p>',
      `<p style="margin: 0 0 16px;"><strong>${escapeHtml(trackingNumber)}</strong></p>`
    )
  }

  textLines.push('Track your document:', trackUrl)
  htmlParts.push(
    `<p style="margin: 0;"><a href="${escapeHtml(trackUrl)}" style="color: #1a8ba8;"><strong>Track your document<strong></a></p>`
  )

  return {
    subject,
    text: textLines.join('\n'),
    html: layout({
      heading: 'Your document is on its way',
      body: htmlParts.join('\n                ')
    })
  }
}
