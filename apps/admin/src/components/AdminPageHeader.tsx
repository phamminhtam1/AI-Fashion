type AdminPageHeaderProps = {
  title: string;
  description: string;
};

export function AdminPageHeader({ title, description }: AdminPageHeaderProps) {
  return (
    <header className="space-y-1">
      <h1 className="admin-page-title text-foreground">{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
    </header>
  );
}
