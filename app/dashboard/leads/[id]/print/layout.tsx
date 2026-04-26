export default function PrintLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="min-h-svh bg-white text-black">{children}</div>;
}
