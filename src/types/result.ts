export interface OkResult<TValue> {
  ok: true;
  value: TValue;
}

export interface ErrResult<TError> {
  ok: false;
  error: TError;
}

export type Result<TValue, TError> = OkResult<TValue> | ErrResult<TError>;

export function ok<TValue>(value: TValue): OkResult<TValue> {
  return {
    ok: true,
    value
  };
}

export function err<TError>(error: TError): ErrResult<TError> {
  return {
    ok: false,
    error
  };
}
