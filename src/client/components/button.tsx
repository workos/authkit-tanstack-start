import type { ComponentPropsWithoutRef } from 'react';

export function Button(props: ComponentPropsWithoutRef<'button'>) {
  return (
    <button
      type="button"
      {...props}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        height: '1.714em',
        padding: '0 0.6em',

        fontFamily: 'inherit',
        fontSize: 'inherit',
        borderRadius: 'min(max(calc(var(--wi-s) * 0.6), 1px), 7px)',
        border: 'none',
        backgroundColor: 'var(--wi-c)',
        color: 'white',

        ...props.style,
      }}
    />
  );
}
