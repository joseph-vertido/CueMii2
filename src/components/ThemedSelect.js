import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

/**
 * App-wide dropdown styled to match the match queue's reservation dropdown —
 * including the open option list (rounded corners, soft borders, the app's
 * font, themed background and hover states).
 *
 * A native <select> can't do this: its option list is drawn by the operating
 * system and ignores CSS. So this renders its own list instead.
 *
 * Usage is unchanged from a native select — pass <option> children, a value,
 * and an onChange handler that reads `e.target.value`.
 *
 * The list is rendered through a portal into <body> and positioned from the
 * trigger's on-screen rect. That matters because an ancestor with a
 * backdrop-filter (our panels use one) becomes the containing block for
 * `position: fixed` children — which would otherwise place the list relative to
 * the panel and let its hidden overflow clip it away.
 *
 * @param {Object} props
 * @param {boolean} props.isDarkMode - Theme mode
 * @param {string} [props.className] - Layout classes for the trigger wrapper
 */
const ThemedSelect = ({
  isDarkMode = true,
  className = '',
  value,
  onChange,
  children,
  disabled = false,
  compact = false,
  ...rest
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const triggerRef = useRef(null);
  const listRef = useRef(null);

  // Read the <option> children into a plain list.
  const options = React.Children.toArray(children)
    .filter((child) => React.isValidElement(child) && child.type === 'option')
    .map((child) => ({ value: child.props.value, label: child.props.children }));

  const selected = options.find((o) => String(o.value) === String(value));

  const position = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const openUp = spaceBelow < 200 && r.top > spaceBelow;
    setCoords({
      left: r.left,
      width: Math.max(r.width, compact ? 132 : 150),
      top: openUp ? undefined : r.bottom + 4,
      bottom: openUp ? window.innerHeight - r.top + 4 : undefined,
    });
  }, [compact]);

  const close = useCallback(() => {
    setIsOpen(false);
    setActiveIndex(-1);
  }, []);

  const open = () => {
    if (disabled) return;
    position();
    setActiveIndex(options.findIndex((o) => String(o.value) === String(value)));
    setIsOpen(true);
  };

  const pick = (optionValue) => {
    close();
    if (onChange) onChange({ target: { value: optionValue } });
  };

  // Close on outside click; keep the list attached while scrolling/resizing.
  useEffect(() => {
    if (!isOpen) return undefined;
    const onPointerDown = (e) => {
      if (
        !triggerRef.current?.contains(e.target) &&
        !listRef.current?.contains(e.target)
      ) {
        close();
      }
    };
    const onReflow = () => position();
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    };
  }, [isOpen, position, close]);

  const onKeyDown = (e) => {
    if (disabled) return;
    if (!isOpen) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
        e.preventDefault();
        open();
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (activeIndex >= 0 && options[activeIndex]) pick(options[activeIndex].value);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <button
        {...rest}
        type="button"
        ref={triggerRef}
        onClick={() => (isOpen ? close() : open())}
        onKeyDown={onKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full min-w-0 flex items-center justify-between gap-2 rounded-lg border text-left transition-colors focus:outline-none focus:ring-1 focus:ring-cyan-500 ${
          compact ? 'pl-2.5 pr-2 py-1 text-[0.8rem]' : 'pl-2.5 pr-2 py-1 text-sm'
        } ${
          disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
        } ${
          isDarkMode
            ? 'bg-slate-800 border-slate-600 text-slate-100 hover:border-slate-500'
            : 'bg-white border-slate-300 text-slate-800 hover:border-slate-400'
        }`}
      >
        <span className="truncate">{selected ? selected.label : ''}</span>
        <svg
          className={`${compact ? 'w-3.5 h-3.5' : 'w-3.5 h-3.5'} flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''} ${
            isDarkMode ? 'text-slate-400' : 'text-slate-500'
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && coords && createPortal(
        <div
          ref={listRef}
          role="listbox"
          style={{
            position: 'fixed',
            left: coords.left,
            top: coords.top,
            bottom: coords.bottom,
            width: coords.width,
            zIndex: 60,
          }}
          className={`${coords.bottom !== undefined ? 'animate-panel-open-up' : 'animate-panel-open'} rounded-lg shadow-xl border overflow-hidden ${
            isDarkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200'
          }`}
        >
          <div className={`${compact ? 'max-h-56' : 'max-h-60'} overflow-y-auto custom-scrollbar py-1`}>
            {options.map((option, i) => {
              const isSelected = String(option.value) === String(value);
              const isActive = i === activeIndex;
              return (
                <button
                  key={String(option.value)}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => pick(option.value)}
                  className={`w-full text-left flex items-center justify-between gap-2 transition-colors ${
                    compact ? 'px-3 py-1.5 text-[0.8rem]' : 'px-3 py-1.5 text-sm'
                  } ${
                    isDarkMode
                      ? `${isActive ? 'bg-slate-700' : ''} ${isSelected ? 'text-cyan-300' : 'text-slate-200'}`
                      : `${isActive ? 'bg-slate-100' : ''} ${isSelected ? 'text-cyan-700' : 'text-slate-700'}`
                  }`}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected && (
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default ThemedSelect;
