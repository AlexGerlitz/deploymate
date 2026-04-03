export const metadata = {
  title: "{{PROJECT_NAME}}",
  description: "{{PROJECT_NAME}} starter application",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
