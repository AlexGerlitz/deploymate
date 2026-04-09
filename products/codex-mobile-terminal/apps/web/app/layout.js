import "./globals.css";

export const metadata = {
  title: "Codex Mobile Console",
  description: "Mobile-first Codex console with advanced terminal fallback"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
