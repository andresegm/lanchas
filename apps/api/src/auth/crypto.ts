import crypto from "node:crypto";

export async function hashPassword(password: string): Promise<string> {
    const salt = crypto.randomBytes(16);
    const key = await scryptAsync(password, salt, 64);
    return `scrypt:${salt.toString("hex")}:${key.toString("hex")}`;
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
    const [alg, saltHex, keyHex] = passwordHash.split(":");
    if (alg !== "scrypt" || !saltHex || !keyHex) return false;
    const salt = Buffer.from(saltHex, "hex");
    const key = Buffer.from(keyHex, "hex");
    const derived = await scryptAsync(password, salt, key.length);
    return crypto.timingSafeEqual(key, derived);
}

export function randomToken(bytes = 32): string {
    return crypto.randomBytes(bytes).toString("base64url");
}

export function sha256Base64Url(input: string): string {
    return crypto.createHash("sha256").update(input).digest("base64url");
}

function scryptAsync(password: string, salt: Buffer, keylen: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        crypto.scrypt(password, salt, keylen, (err: NodeJS.ErrnoException | null, derivedKey: Buffer) => {
            if (err) return reject(err);
            resolve(derivedKey as Buffer);
        });
    });
}

