import "./globals.css";
import Link from "next/link";
import { Manrope, Space_Grotesk } from "next/font/google";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata = {
  title: "DeployMate",
  description:
    "DeployMate is a source-available deployment control surface for small teams. Commercial use requires a separate license.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${spaceGrotesk.variable}`}>
        {children}
        <footer className="siteFooter">
          <div className="container siteFooterInner">
            <div className="siteFooterBrand">
              <span className="siteFooterEyebrow">DeployMate</span>
              <strong>Source-available deployment control for small teams.</strong>
              <p>
                Public product evaluation stays open. Commercial use of the code requires a
                separate license.
              </p>
            </div>

            <div className="siteFooterLinks" aria-label="Footer links">
              <Link href="/" className="siteFooterLink">
                Homepage
              </Link>
              <Link href="/login" className="siteFooterLink">
                Live product
              </Link>
              <Link href="/commercial-license" className="siteFooterLink">
                Commercial license
              </Link>
              <Link href="/upgrade" className="siteFooterLink">
                Request access
              </Link>
              <a
                href="mailto:alexgerlitz@users.noreply.github.com?subject=DeployMate%20commercial%20license"
                className="siteFooterLink"
              >
                Email licensing
              </a>
            </div>

            <div className="siteFooterMeta">
              <span>Business use, SaaS, internal company rollout, and resale require explicit permission. First response usually within 2 business days.</span>
              <a href="https://deploymatecloud.ru" className="inlineLink">
                deploymatecloud.ru
              </a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
