import { useCallback, useState } from 'react';
import { validate } from '../validation/schemas';

/**
 * Minimal form state + schema validation.
 * - validateAll(): runs the zod schema, populates errors, returns parsed data or null
 * - setServerErrors(err): shows API validation errors on the matching fields
 */
export function useForm(initialValues, schema) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});

  const setValue = useCallback((name, value) => {
    setValues((v) => ({ ...v, [name]: value }));
    setErrors((e) => (e[name] ? { ...e, [name]: undefined } : e));
  }, []);

  const handleChange = useCallback((e) => setValue(e.target.name, e.target.value), [setValue]);

  const validateAll = useCallback((candidate = values) => {
    const result = validate(schema, candidate);
    setErrors(result.errors);
    return result.data;
  }, [schema, values]);

  const setServerErrors = useCallback((apiError) => {
    const fields = apiError?.fieldErrors ?? {};
    setErrors(Object.keys(fields).length ? fields : { form: apiError?.message ?? 'Something went wrong.' });
  }, []);

  const reset = useCallback((next = initialValues) => { setValues(next); setErrors({}); }, [initialValues]);

  return { values, errors, setValue, handleChange, validateAll, setServerErrors, reset, setErrors };
}
