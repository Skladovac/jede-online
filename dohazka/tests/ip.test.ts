import { describe, expect, it } from 'vitest'
import { ipLimitKey } from '@/lib/ip'

describe('ipLimitKey', () => {
  it('IPv4 nechá být', () => {
    expect(ipLimitKey('1.2.3.4')).toBe('1.2.3.4')
  })
  it('zkrácené i plné IPv6 ze stejného /64 dají stejný klíč', () => {
    const k = ipLimitKey('2001:db8::1')
    expect(k).toBe('2001:db8:0:0::/64')
    expect(ipLimitKey('2001:db8::2')).toBe(k)
    expect(ipLimitKey('2001:0db8:0000:0000:aaaa:bbbb:cccc:dddd')).toBe(k)
  })
  it('jiný /64 dá jiný klíč', () => {
    expect(ipLimitKey('2001:db8:0:1::1')).not.toBe(ipLimitKey('2001:db8::1'))
  })
  it('IPv4-mapped adresu sníží na IPv4', () => {
    expect(ipLimitKey('::ffff:1.2.3.4')).toBe('1.2.3.4')
    expect(ipLimitKey('::ffff:102:304')).toBe('1.2.3.4')
  })
  it('zvládne loopback a zónu', () => {
    expect(ipLimitKey('::1')).toBe('0:0:0:0::/64')
    expect(ipLimitKey('fe80::1%eth0')).toBe('fe80:0:0:0::/64')
  })
  it('nesmysl a prázdno dají společný klíč, ne výjimku', () => {
    expect(ipLimitKey('')).toBe('unknown')
    expect(ipLimitKey('a:b:c')).toBe('unknown')
    expect(ipLimitKey('1:2:3:4:5:6:7:8:9')).toBe('unknown')
  })
})
