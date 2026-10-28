import { customAlphabet } from "nanoid";

const generateRandomCode = customAlphabet(
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
  7
);

export default function generateCode() {
  return generateRandomCode();
} 