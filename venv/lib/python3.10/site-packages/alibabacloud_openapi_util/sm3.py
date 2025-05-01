import binascii
import copy

IV = "7380166f 4914b2b9 172442d7 da8a0600 a96f30bc 163138aa e38dee4d b0fb0e4e"
IV = int(IV.replace(" ", ""), 16)
a = []
for i in range(0, 8):
    a.append(0)
    a[i] = (IV >> ((7 - i) * 32)) & 0xFFFFFFFF
IV = a

T_j = []
for i in range(0, 16):
    T_j.append(0)
    T_j[i] = 0x79cc4519
for i in range(16, 64):
    T_j.append(0)
    T_j[i] = 0x7a879d8a


def rotate_left(a, k):
    k = k % 32
    return ((a << k) & 0xFFFFFFFF) | ((a & 0xFFFFFFFF) >> (32 - k))


def FF_j(X, Y, Z, j):
    if 0 <= j < 16:
        ret = X ^ Y ^ Z
    elif 16 <= j < 64:
        ret = (X & Y) | (X & Z) | (Y & Z)
    return ret


def GG_j(X, Y, Z, j):
    if 0 <= j < 16:
        ret = X ^ Y ^ Z
    elif 16 <= j < 64:
        # ret = (X | Y) & ((2 ** 32 - 1 - X) | Z)
        ret = (X & Y) | ((~ X) & Z)
    return ret


def P_0(X):
    return X ^ (rotate_left(X, 9)) ^ (rotate_left(X, 17))


def P_1(X):
    return X ^ (rotate_left(X, 15)) ^ (rotate_left(X, 23))


def CF(V_i, B_i):
    W = []
    for i in range(16):
        weight = 0x1000000
        data = 0
        for k in range(i * 4, (i + 1) * 4):
            data = data + B_i[k] * weight
            weight = int(weight / 0x100)
        W.append(data)

    for j in range(16, 68):
        W.append(0)
        W[j] = P_1(W[j - 16] ^ W[j - 9] ^ (rotate_left(W[j - 3], 15))) ^ (rotate_left(W[j - 13], 7)) ^ W[j - 6]
        str1 = "%08x" % W[j]
    W_1 = []
    for j in range(0, 64):
        W_1.append(0)
        W_1[j] = W[j] ^ W[j + 4]
        str1 = "%08x" % W_1[j]

    A, B, C, D, E, F, G, H = V_i
    """
    print "00",
    out_hex([A, B, C, D, E, F, G, H])
    """
    for j in range(0, 64):
        SS1 = rotate_left(((rotate_left(A, 12)) + E + (rotate_left(T_j[j], j))) & 0xFFFFFFFF, 7)
        SS2 = SS1 ^ (rotate_left(A, 12))
        TT1 = (FF_j(A, B, C, j) + D + SS2 + W_1[j]) & 0xFFFFFFFF
        TT2 = (GG_j(E, F, G, j) + H + SS1 + W[j]) & 0xFFFFFFFF
        D = C
        C = rotate_left(B, 9)
        B = A
        A = TT1
        H = G
        G = rotate_left(F, 19)
        F = E
        E = P_0(TT2)

        A = A & 0xFFFFFFFF
        B = B & 0xFFFFFFFF
        C = C & 0xFFFFFFFF
        D = D & 0xFFFFFFFF
        E = E & 0xFFFFFFFF
        F = F & 0xFFFFFFFF
        G = G & 0xFFFFFFFF
        H = H & 0xFFFFFFFF
        """
        str1 = "%02d" % j
        if str1[0] == "0":
            str1 = ' ' + str1[1:]
        out_hex([A, B, C, D, E, F, G, H])
        """

    V_i_1 = [
        A ^ V_i[0],
        B ^ V_i[1],
        C ^ V_i[2],
        D ^ V_i[3],
        E ^ V_i[4],
        F ^ V_i[5],
        G ^ V_i[6],
        H ^ V_i[7]
    ]
    return V_i_1


def hash_msg(msg):
    len1 = len(msg)
    reserve1 = len1 % 64
    msg.append(0x80)
    reserve1 = reserve1 + 1
    # 56-64, add 64 byte
    range_end = 56
    if reserve1 > range_end:
        range_end = range_end + 64

    for i in range(reserve1, range_end):
        msg.append(0x00)

    bit_length = (len1) * 8
    bit_length_str = [bit_length % 0x100]
    for i in range(7):
        bit_length = int(bit_length / 0x100)
        bit_length_str.append(bit_length % 0x100)
    for i in range(8):
        msg.append(bit_length_str[7 - i])

    group_count = round(len(msg) / 64)

    b = []
    for i in range(0, group_count):
        b.append(msg[i * 64:(i + 1) * 64])

    v = [IV]
    for i in range(0, group_count):
        v.append(CF(v[i], b[i]))

    y = v[i + 1]
    result = ""
    for i in y:
        result = '%s%08x' % (result, i)
    return result


def to_byte_array(msg):  # 转换成byte数组
    ml = len(msg)
    msg_byte = []
    for i in range(ml):
        msg_byte.append(msg[i])
    return msg_byte


def hash_sm3(msg):
    msg_byte = to_byte_array(msg)
    return binascii.a2b_hex(hash_msg(msg_byte))


class Sm3:
    block_size = 64

    def __init__(self, msg_byte=b''):
        self.byte_array = to_byte_array(msg_byte)

    def update(self, data):
        self.byte_array.extend(to_byte_array(data))

    def digest(self):
        return binascii.a2b_hex(hash_msg(self.byte_array))

    def hexdigest(self):
        return hash_msg(self.byte_array)

    @property
    def digest_size(self):
        return len(self.byte_array)

    def copy(self):
        return copy.deepcopy(self)
