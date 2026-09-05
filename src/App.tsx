import AccountGate from './components/AccountGate';
import AppErrorBoundary from './components/AppErrorBoundary';

/** 薄いラッパ。必要なら将来ヘッダー/フッター等をここで足す */
export default function App() {
  return <AppErrorBoundary><AccountGate /></AppErrorBoundary>;
}

import './student.css';
