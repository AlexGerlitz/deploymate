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
            <div className="siteFooterLinks" aria-label="Footer links">
              <Link href="/" className="siteFooterLink">
                Home
              </Link>
              <Link href="/login" className="siteFooterLink">
                Open app
              </Link>
            </div>

            <div className="siteFooterMeta">
              <span>DeployMate</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
