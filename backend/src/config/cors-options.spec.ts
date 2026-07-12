import { createCorsOptions, parseFrontendOrigins } from './cors-options';

describe('cors-options', () => {
  it('uses a single origin directly', () => {
    expect(createCorsOptions('http://localhost:3001')).toEqual({
      origin: 'http://localhost:3001',
      credentials: true,
    });
  });

  it('supports comma-separated origins', () => {
    expect(
      createCorsOptions('http://localhost:3001, http://localhost:3100'),
    ).toEqual({
      origin: ['http://localhost:3001', 'http://localhost:3100'],
      credentials: true,
    });
  });

  it('deduplicates repeated origins', () => {
    expect(
      parseFrontendOrigins('http://localhost:3001,http://localhost:3001'),
    ).toEqual(['http://localhost:3001']);
  });

  it('rejects empty origin entries', () => {
    expect(() => parseFrontendOrigins('http://localhost:3001,')).toThrow(
      'FRONTEND_ORIGIN must contain one or more origins',
    );
  });
});
