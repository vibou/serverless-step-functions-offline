/* istanbul ignore file */
import enums from '../enum';

describe('enum.js', () => {
  const supportedComparisonOperator = [
    'BooleanEquals',
    'NumericEquals',
    'NumericGreaterThan',
    'NumericGreaterThanEquals',
    'NumericLessThan',
    'NumericLessThanEquals',
    'StringEquals',
    'StringGreaterThan',
    'StringGreaterThanEquals',
    'StringLessThan',
    'StringLessThanEquals',
    'TimestampEquals',
    'TimestampGreaterThan',
    'TimestampGreaterThanEquals',
    'TimestampLessThan',
    'TimestampLessThanEquals',
  ];

  const firstDate = new Date();

  describe('#supportedComparisonOperator()', () => {
    it('should have supportedComparisonOperator', () => expect(enums.supportedComparisonOperator).not.toHaveLength(0));

    it('should have 16 supportedComparisonOperator', () => {
      expect(enums.supportedComparisonOperator).toEqual(supportedComparisonOperator);
    });
  });

  describe('#convertOperator()', () => {
    it('should have convertOperator', () => expect(Object.keys(enums.convertOperator)).not.toHaveLength(0));

    describe('#BooleanEquals()', () => {
      it('should BooleanEquals return true', () => {
        const result = enums.convertOperator.BooleanEquals(true, true);
        expect(result).toBe(true);
      });

      it('should BooleanEquals return false', () => {
        const result = enums.convertOperator.BooleanEquals(true, false);
        expect(result).toBe(false);
      });
    });

    describe('#NumericEquals()', () => {
      it('should NumericEquals return true', () => {
        const result = enums.convertOperator.NumericEquals(11, 11);
        expect(result).toBe(true);
      });

      it('should NumericEquals return false', () => {
        const result = enums.convertOperator.NumericEquals(11, 0);
        expect(result).toBe(false);
      });
    });

    describe('#NumericGreaterThan()', () => {
      it('should NumericGreaterThan return true', () => {
        const result = enums.convertOperator.NumericGreaterThan(12, 11);
        expect(result).toBe(true);
      });

      it('should NumericEquals return false', () => {
        const result = enums.convertOperator.NumericGreaterThan(11, 11);
        expect(result).toBe(false);
      });
    });

    describe('#NumericGreaterThanEquals()', () => {
      it('should NumericEquals return true', () => {
        const result = enums.convertOperator.NumericGreaterThanEquals(11, 11);
        expect(result).toBe(true);
      });

      it('should NumericGreaterThanEquals return false', () => {
        const result = enums.convertOperator.NumericGreaterThanEquals(11, 12);
        expect(result).toBe(false);
      });
    });

    describe('#NumericLessThan()', () => {
      it('should NumericLessThan return true', () => {
        const result = enums.convertOperator.NumericLessThan(11, 12);
        expect(result).toBe(true);
      });

      it('should NumericLessThan return false', () => {
        const result = enums.convertOperator.NumericLessThan(11, 11);
        expect(result).toBe(false);
      });
    });

    describe('#NumericLessThan()', () => {
      it('should NumericLessThan return true', () => {
        const result = enums.convertOperator.NumericLessThan(11, 12);
        expect(result).toBe(true);
      });

      it('should NumericLessThan return false', () => {
        const result = enums.convertOperator.NumericLessThan(11, 11);
        expect(result).toBe(false);
      });
    });

    describe('#NumericLessThanEquals()', () => {
      it('should NumericLessThanEquals return true', () => {
        const result = enums.convertOperator.NumericLessThanEquals(11, 11);
        expect(result).toBe(true);
      });

      it('should NumericLessThanEquals return false', () => {
        const result = enums.convertOperator.NumericLessThanEquals(13, 12);
        expect(result).toBe(false);
      });
    });

    describe('#StringEquals()', () => {
      it('should StringEquals return true', () => {
        const result = enums.convertOperator.StringEquals('Equal', 'Equal');
        expect(result).toBe(true);
      });

      it('should StringEquals return false', () => {
        const result = enums.convertOperator.StringEquals('Equal', 'EqUal');
        expect(result).toBe(false);
      });
    });

    describe('#StringGreaterThan()', () => {
      it('should StringGreaterThan return true', () => {
        const result = enums.convertOperator.StringGreaterThan('B', 'A');
        expect(result).toBe(true);
      });

      it('should StringGreaterThan return false', () => {
        const result = enums.convertOperator.StringGreaterThan('A', 'A');
        expect(result).toBe(false);
      });
    });

    describe('#StringGreaterThanEquals()', () => {
      it('should StringGreaterThanEquals return true', () => {
        const result = enums.convertOperator.StringGreaterThanEquals('A', 'A');
        expect(result).toBe(true);
      });

      it('should StringGreaterThanEquals return false', () => {
        const result = enums.convertOperator.StringGreaterThanEquals('A', 'B');
        expect(result).toBe(false);
      });
    });

    describe('#StringLessThan()', () => {
      it('should StringLessThan return true', () => {
        const result = enums.convertOperator.StringLessThan('B', 'a');
        expect(result).toBe(true);
      });

      it('should StringLessThan return false', () => {
        const result = enums.convertOperator.StringLessThan('A', 'A');
        expect(result).toBe(false);
      });
    });

    describe('#StringLessThanEquals()', () => {
      it('should StringLessThanEquals return true', () => {
        const result = enums.convertOperator.StringLessThanEquals('A', 'A');
        expect(result).toBe(true);
      });

      it('should StringLessThanEquals return false', () => {
        const result = enums.convertOperator.StringLessThanEquals('C', 'B');
        expect(result).toBe(false);
      });
    });

    describe('#TimestampEquals()', () => {
      const secondDate = new Date();
      it('should TimestampEquals return true', () => {
        const result = enums.convertOperator.TimestampEquals(firstDate, firstDate);
        expect(result).toBe(true);
      });

      it('should TimestampEquals return false', () => {
        const result = enums.convertOperator.TimestampEquals(firstDate, secondDate);
        expect(result).toBe(false);
      });
    });

    describe('#TimestampGreaterThan()', () => {
      const secondDate = new Date();
      it('should TimestampGreaterThan return true', () => {
        const result = enums.convertOperator.TimestampGreaterThan(secondDate, firstDate);
        expect(result).toBe(true);
      });

      it('should TimestampGreaterThan return false', () => {
        const result = enums.convertOperator.TimestampGreaterThan(firstDate, secondDate);
        expect(result).toBe(false);
      });
    });

    describe('#TimestampGreaterThanEquals()', () => {
      const secondDate = new Date();
      it('should TimestampGreaterThanEquals return true', () => {
        const result = enums.convertOperator.TimestampGreaterThanEquals(secondDate, secondDate);
        expect(result).toBe(true);
      });

      it('should TimestampGreaterThanEquals return false', () => {
        const result = enums.convertOperator.TimestampGreaterThanEquals(firstDate, secondDate);
        expect(result).toBe(false);
      });
    });

    describe('#TimestampGreaterThan()', () => {
      const secondDate = new Date();
      it('should TimestampGreaterThan return true', () => {
        const result = enums.convertOperator.TimestampLessThan(firstDate, secondDate);
        expect(result).toBe(true);
      });

      it('should TimestampGreaterThan return false', () => {
        const result = enums.convertOperator.TimestampLessThan(secondDate, firstDate);
        expect(result).toBe(false);
      });
    });

    describe('#TimestampLessThanEquals()', () => {
      const secondDate = new Date();
      it('should TimestampLessThanEquals return true', () => {
        const result = enums.convertOperator.TimestampLessThanEquals(secondDate, secondDate);
        expect(result).toBe(true);
      });

      it('should TimestampGreaterThan return false', () => {
        const result = enums.convertOperator.TimestampLessThanEquals(secondDate, firstDate);
        expect(result).toBe(false);
      });
    });
  });
});
