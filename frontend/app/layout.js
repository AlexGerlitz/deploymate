import "./globals.css";

export const metadata = {
  title: "DeployMate",
  description: "DeployMate frontend",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
