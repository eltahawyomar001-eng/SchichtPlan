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
# The owner of the business, not whoever is operating the tool. A commercial
# email in Germany has to identify the sender (§ 5 TMG), and naming anyone
# else misstates who the recipient is dealing with.
FROM_NAME = "Mohammad Bashabsheh - Shiftfy"
SIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                        "shiftfy-signature.html")

USER = os.environ["SHIFTFY_SMTP_USER"]
PASS = os.environ["SHIFTFY_SMTP_PASS"]

# Plain-text fallback. Carries the same mandatory details as the HTML part:
# a recipient whose client strips HTML must still get the Impressum
# information, so this is not a shortened version of the signature.
SIG_TEXT = """Mit freundlichen Gruessen

Mohammad Bashabsheh
Inhaber - Bashabsheh Vergabepartner
Shiftfy | Schichtplanung & Zeiterfassung

E  Kontakt@shiftfy.info
T  +49 176 30365636
W  https://www.shiftfy.de
A  Kaiserring 10-16, 68161 Mannheim, Deutschland

Bashabsheh Vergabepartner - Inhaber: Mohammad Bashabsheh
Kleinunternehmer gem. Paragraf 19 UStG (keine Umsatzsteuer ausgewiesen)
Impressum: https://www.shiftfy.de/impressum
Datenschutz: https://www.shiftfy.de/datenschutz

Diese E-Mail kann vertrauliche Informationen enthalten. Sollten Sie nicht der
richtige Adressat sein, informieren Sie bitte den Absender und loeschen Sie
diese E-Mail."""


def signature_html():
    """The signature, read from file rather than inlined.

    It is a block of hand-tuned table markup that renders across mail clients;
    retyping it into a Python string is how it drifts from the one the
    business actually uses.
    """
    with open(SIG_PATH, encoding="utf-8") as f:
        return f.read()


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
        "<html><body style=\"margin:0;padding:0\">%s%s</body></html>"
        % (paras, signature_html()),
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
