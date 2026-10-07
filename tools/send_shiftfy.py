# -*- coding: utf-8 -*-
"""
Send a Shiftfy reply via Strato SMTP, filing a copy in Sent.

Same shape as opticon-site/tools/send.py: multipart HTML with a plain-text
alternative, sent over SMTP_SSL, then APPENDed to the IMAP Sent folder.
The IMAP append is not optional -- SMTP alone does not put the message in
Sent, and a reply the sender cannot find later is a reply they will send
again.

Default is a dry run. Pass --send to deliver.
"""
import os, ssl, sys, time, html, re, smtplib, imaplib
from email.utils import formatdate, formataddr
from email.message import EmailMessage

SMTP_HOST, SMTP_PORT = "smtp.strato.de", 465
IMAP_HOST, IMAP_PORT = "imap.strato.de", 993
FROM_NAME = "Omar Rageh - Shiftfy"

USER = os.environ["SHIFTFY_SMTP_USER"]
PASS = os.environ["SHIFTFY_SMTP_PASS"]

SIG_TEXT = """Mit freundlichen Gruessen

Omar Rageh
Shiftfy
kontakt@shiftfy.info
https://www.shiftfy.de"""

SIG_HTML = """<table style="border-collapse:collapse;width:420px;max-width:100%;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.45;color:#333333" role="presentation" border="0" cellspacing="0" cellpadding="0"><tbody>
<tr><td style="padding:0 0 14px 0">Mit freundlichen Gr&uuml;&szlig;en</td></tr>
<tr><td style="padding:0 0 4px 0;font-size:15px;font-weight:bold;color:#059669">Shiftfy</td></tr>
<tr><td style="padding:0 0 10px 0;font-size:14px;font-weight:bold;color:#333333">Omar Rageh</td></tr>
<tr><td style="padding:0 0 14px 0;font-size:13px;line-height:1.5">
<a style="color:#059669;text-decoration:none" href="mailto:kontakt@shiftfy.info">kontakt@shiftfy.info</a><br>
<a style="color:#059669;text-decoration:none" href="https://www.shiftfy.de">www.shiftfy.de</a></td></tr>
</tbody></table>"""


def build(to, subject, body, in_reply_to=None):
    m = EmailMessage()
    m["From"] = formataddr((FROM_NAME, USER))
    m["To"] = to
    m["Subject"] = subject
    m["Reply-To"] = USER
    m["Date"] = formatdate(localtime=True)
    if in_reply_to:
        m["In-Reply-To"] = in_reply_to
        m["References"] = in_reply_to
    m.set_content(body + "\n\n" + SIG_TEXT)
    paras = "".join(
        '<p style="margin:0 0 12px 0;font-family:Arial,Helvetica,sans-serif;'
        'font-size:13px;line-height:1.55;color:#333333">%s</p>'
        % html.escape(p).replace("\n", "<br>")
        for p in re.split(r"\n\s*\n", body) if p.strip()
    )
    m.add_alternative(
        "<html><body style=\"margin:0;padding:0\">%s%s</body></html>" % (paras, SIG_HTML),
        subtype="html",
    )
    return m


def main():
    path = sys.argv[1]
    live = "--send" in sys.argv
    raw = open(path, encoding="utf-8").read()
    lines = raw.split("\n")
    to = lines[0].replace("An:", "").strip()
    subject = lines[1].replace("Betreff:", "").strip()
    body = "\n".join(lines[2:]).strip("\n")

    print(("LIVE SEND" if live else "DRY RUN") + f" -> {to}")
    print(f"Subject: {subject}\n")
    print(body)
    if not live:
        print("\nNothing sent. Re-run with --send.")
        return

    ctx = ssl.create_default_context()
    msg = build(to, subject, body)
    s = smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=30, context=ctx)
    s.login(USER, PASS)
    s.send_message(msg)
    s.quit()
    print("SENT")

    # Strato names the folder differently per mailbox; try the usual ones.
    try:
        imap = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT, ssl_context=ctx)
        imap.login(USER, PASS)
        for folder in ("Sent", "Sent Items", "INBOX.Sent", "Gesendet"):
            try:
                r = imap.append(folder, "\\Seen",
                                imaplib.Time2Internaldate(time.time()),
                                msg.as_bytes())
                if r[0] == "OK":
                    print(f"filed copy in {folder}")
                    break
            except Exception:
                continue
        imap.logout()
    except Exception as e:
        print("(warn) could not file copy:", e)


if __name__ == "__main__":
    main()
