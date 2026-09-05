import TimetableApp from "./TimetableApp";
import AppErrorBoundary from './components/AppErrorBoundary';

/** 薄いラッパ。必要なら将来ヘッダー/フッター等をここで足す */
export default function App() {
  return <AppErrorBoundary><TimetableApp /></AppErrorBoundary>;
}

import './student.css';
