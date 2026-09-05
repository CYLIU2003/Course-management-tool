import { Component, type ReactNode } from 'react';

export default class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    return <main className="app-container tt-card" role="alert"><h1>画面を表示できませんでした</h1><p>保存済みのデータを残して、画面を再読み込みできます。</p><button onClick={() => window.location.reload()}>再読み込み</button>{import.meta.env.DEV && <pre>{this.state.error.stack}</pre>}</main>;
  }
}
