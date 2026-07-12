export default function AdminLoading() {
  return (
    <main className="admin-loading-screen" aria-busy="true" aria-label="Carregando painel / 正在加载后台">
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
