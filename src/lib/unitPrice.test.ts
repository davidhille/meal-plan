import { describe, expect, test } from 'bun:test';
import { neededAmount, packagesNeeded, parseAmount, parseEuro, unitPrice } from './unitPrice';

describe('parseEuro', () => {
  test('deutsche und englische Schreibweise', () => {
    expect(parseEuro('1,99 €')).toBe(1.99);
    expect(parseEuro('1.99')).toBe(1.99);
    expect(parseEuro(2.5)).toBe(2.5);
  });
  test('Unlesbares ergibt null', () => {
    expect(parseEuro('abc')).toBeNull();
    expect(parseEuro(null)).toBeNull();
  });
});

describe('parseAmount', () => {
  test('rechnet in Grundeinheiten um', () => {
    expect(parseAmount('500 g')).toEqual({ qty: 500, unit: 'g' });
    expect(parseAmount('1 kg')).toEqual({ qty: 1000, unit: 'g' });
    expect(parseAmount('1,5 l')).toEqual({ qty: 1500, unit: 'ml' });
    expect(parseAmount('10 Stück')).toEqual({ qty: 10, unit: 'stk' });
    expect(parseAmount('ca. 250g')).toEqual({ qty: 250, unit: 'g' });
  });
  test('Multipacks werden multipliziert', () => {
    const r = parseAmount('6 x 0,33 l');
    expect(r?.unit).toBe('ml');
    expect(r?.qty).toBeCloseTo(1980);
  });
  test('ohne Mengenangabe null', () => expect(parseAmount('xyz')).toBeNull());
});

// toLocaleString setzt ein geschütztes Leerzeichen vor „€“
const label = (price: number | null, amount: string) => unitPrice(price, amount)?.label.replace(/\s/g, ' ');

describe('unitPrice', () => {
  test('€/kg, €/l und €/Stk.', () => {
    expect(label(1.99, '500 g')).toBe('3,98 €/kg');
    expect(label(0.89, '1 l')).toBe('0,89 €/l');
    expect(label(2, '6 Stück')).toBe('0,33 €/Stk.');
  });
  test('ohne Preis kein Grundpreis', () => expect(unitPrice(null, '500 g')).toBeNull());
});

describe('neededAmount', () => {
  test('liest die Menge aus dem Listeneintrag', () => {
    expect(neededAmount('800g Spaghetti')).toEqual({ qty: 800, unit: 'g' });
    expect(neededAmount('1,5 kg Kartoffeln')).toEqual({ qty: 1500, unit: 'g' });
    expect(neededAmount('3 Zwiebeln')).toEqual({ qty: 3, unit: 'stk' });
    expect(neededAmount('Salz')).toBeNull();
  });
  test('EL, Dosen usw. sind keine Stückzahl', () => {
    expect(neededAmount('2 EL Öl')).toBeNull();
    expect(neededAmount('2 Dosen Tomaten')).toBeNull();
  });
});

describe('packagesNeeded', () => {
  test('rundet auf ganze Packungen auf', () => {
    expect(packagesNeeded('800g Spaghetti', '500 g')).toBe(2);
    expect(packagesNeeded('1,5 kg Kartoffeln', '2 kg')).toBe(1);
  });
  test('unpassende Einheiten oder fehlende Menge: 1', () => {
    expect(packagesNeeded('3 Zwiebeln', '1 kg')).toBe(1);
    expect(packagesNeeded('Salz', '500 g')).toBe(1);
  });
  test('höchstens 20 Packungen', () => expect(packagesNeeded('50 kg Mehl', '1 kg')).toBe(20));
});
