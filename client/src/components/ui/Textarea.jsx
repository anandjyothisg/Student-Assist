import React, { forwardRef } from 'react';
import { Field } from './Input';

export const Textarea = forwardRef(function Textarea(
  { label, hint, helperText, error, id, rows = 4, className = '', wrapperClassName = '', ...props },
  ref,
) {
  return (
    <Field label={label} hint={hint ?? helperText} error={error} id={id} className={wrapperClassName}>
      {(p) => (
        <textarea
          ref={ref}
          rows={rows}
          {...p}
          {...props}
          className={`field-control resize-y leading-relaxed ${className}`}
        />
      )}
    </Field>
  );
});
