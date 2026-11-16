import { Component } from 'react';
import Logo from './Logo.jsx';

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) { return { error }; }

  componentDidCatch(error, info) { console.error('UI error:', error, info.componentStack); }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 p-6 text-center">
        <Logo size={64} />
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Something went wrong</h1>
          <p className="mx-auto mt-2 max-w-md text-slate-400">The app hit an unexpected error. Your messages are safe; reloading usually fixes it.</p>
        </div>
        <button className="btn-primary" onClick={() => window.location.reload()}>Reload</button>
      </div>
    );
  }
}
