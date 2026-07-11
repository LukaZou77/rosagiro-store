export default function AdminLoading() {
  return (
    <main className="admin-loading-screen" aria-busy="true" aria-label="Carregando painel">
      <div className="admin-loading-sidebar" />
      <div className="admin-loading-content">
        <span />
        <span />
        <span />
        <span />
      </div>
    </main>
  );
}
