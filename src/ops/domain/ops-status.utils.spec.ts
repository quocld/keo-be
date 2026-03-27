import {
  assertReceiptStatus,
  assertTripStatus,
  isReceiptStatus,
  isTripStatus,
} from './ops-status.utils';
import { ReceiptStatusEnum } from './receipt-status.enum';
import { TripStatusEnum } from './trip-status.enum';

describe('ops-status.utils', () => {
  it('should isTripStatus accept valid values', () => {
    expect(isTripStatus(TripStatusEnum.planned)).toBe(true);
    expect(isTripStatus(TripStatusEnum.inProgress)).toBe(true);
    expect(isTripStatus('invalid')).toBe(false);
  });

  it('should isReceiptStatus accept valid values', () => {
    expect(isReceiptStatus(ReceiptStatusEnum.pending)).toBe(true);
    expect(isReceiptStatus('invalid')).toBe(false);
  });

  it('should assertTripStatus throw on invalid value', () => {
    expect(() => assertTripStatus('invalid')).toThrow(/Invalid trip status/i);
  });

  it('should assertReceiptStatus throw on invalid value', () => {
    expect(() => assertReceiptStatus('invalid')).toThrow(
      /Invalid receipt status/i,
    );
  });
});
