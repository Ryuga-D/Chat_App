import sys
import json
import hashlib
import random
from Crypto.Cipher import AES
from Crypto.Random import get_random_bytes
from Crypto.Util.Padding import pad, unpad
from PIL import Image
import numpy as np
import os

class ShamirSecretSharing:
    def __init__(self):
        self.prime = 2**256 + 297
    
    def _eval_at(self, poly, x):
        accum = 0
        for coeff in reversed(poly):
            accum *= x
            accum += coeff
            accum %= self.prime
        return accum
    
    def split_secret(self, secret_hex, n_shares, threshold):
        secret_int = int(secret_hex, 16)
        if secret_int >= self.prime:
            raise ValueError("Secret too large for prime")
        
        coeffs = [secret_int] + [random.randrange(self.prime) for _ in range(threshold - 1)]
        
        shares = []
        for i in range(1, n_shares + 1):
            y = self._eval_at(coeffs, i)
            shares.append((i, y))
        
        return shares
    
    def recover_secret(self, shares):
        if not shares:
            raise ValueError("No shares provided")
        
        secret = 0
        for i, (xi, yi) in enumerate(shares):
            li = 1
            for j, (xj, yj) in enumerate(shares):
                if i != j:
                    li = (li * (-xj) * pow(xi - xj, -1, self.prime)) % self.prime
            secret = (secret + yi * li) % self.prime
        
        return format(secret, '064x')

class FingerprintCryptoSystem:
    def __init__(self):
        self.sss = ShamirSecretSharing()
    
    def bytes_to_hex(self, data):
        """Convert bytes to hexadecimal string"""
        return data.hex()
    
    def hex_to_bytes(self, hex_string):
        """Convert hexadecimal string to bytes"""
        return bytes.fromhex(hex_string)
    
    def process_fingerprint_hex(self, fingerprint_hex):
        """
        Process hexadecimal fingerprint string and return normalized hex
        """
        # Remove any whitespace and convert to lowercase
        fingerprint_hex = fingerprint_hex.strip().lower()
        
        # Validate that it's a valid hex string
        try:
            int(fingerprint_hex, 16)
        except ValueError:
            raise ValueError(f"Invalid hexadecimal fingerprint: {fingerprint_hex}")
            
        return fingerprint_hex
    
    def hash_fingerprint(self, fingerprint_hex):
        """
        Create SHA-256 hash of the hexadecimal fingerprint
        """
        processed_hex = self.process_fingerprint_hex(fingerprint_hex)
        # Convert hex to bytes, then hash
        fingerprint_bytes = bytes.fromhex(processed_hex)
        return hashlib.sha256(fingerprint_bytes).hexdigest()
    
    def combine_fingerprints(self, fp1_hex, fp2_hex):
        """
        Combine two hexadecimal fingerprints using XOR
        """
        fp1_processed = self.process_fingerprint_hex(fp1_hex)
        fp2_processed = self.process_fingerprint_hex(fp2_hex)
        
        # Create hashes for identification
        hash1 = self.hash_fingerprint(fp1_hex)
        hash2 = self.hash_fingerprint(fp2_hex)
        
        # XOR the original hex values (not the hashes)
        fp1_int = int(fp1_processed, 16)
        fp2_int = int(fp2_processed, 16)
        
        # Ensure both are same length by padding with zeros
        max_len = max(len(fp1_processed), len(fp2_processed))
        fp1_padded = fp1_processed.zfill(max_len)
        fp2_padded = fp2_processed.zfill(max_len)
        
        fp1_int = int(fp1_padded, 16)
        fp2_int = int(fp2_padded, 16)
        
        combined_int = fp1_int ^ fp2_int
        combined_hex = format(combined_int, f'0{max_len}x')
        
        # Ensure we have at least 64 characters for AES-256
        if len(combined_hex) < 64:
            combined_hex = combined_hex.zfill(64)
        
        return combined_hex, hash1, hash2
    
    def generate_encryption_key(self, combined_fingerprint_hex):
        """
        Generate AES key from combined fingerprint hex
        """
        # Take first 64 hex characters (32 bytes) for AES-256
        key_hex = combined_fingerprint_hex[:64]
        key = bytes.fromhex(key_hex)
        return key
    
    def encrypt_data(self, data, key):
        cipher = AES.new(key, AES.MODE_CBC)
        
        if isinstance(data, str):
            data = data.encode('utf-8')
        
        padded_data = pad(data, AES.block_size)
        encrypted_data = cipher.encrypt(padded_data)
        
        return cipher.iv + encrypted_data
    
    def decrypt_data(self, encrypted_data, key):
        iv = encrypted_data[:16]
        ciphertext = encrypted_data[16:]
        
        cipher = AES.new(key, AES.MODE_CBC, iv)
        decrypted_padded = cipher.decrypt(ciphertext)
        
        decrypted_data = unpad(decrypted_padded, AES.block_size)
        return decrypted_data
    
    def embed_in_image(self, image_path, encrypted_data, output_path):
        img = Image.open(image_path)
        img_array = np.array(img)
        
        data_binary = ''.join(format(byte, '08b') for byte in encrypted_data)
        delimiter = '1111111111111110'
        data_binary += delimiter
        
        total_pixels = img_array.size
        if len(data_binary) > total_pixels:
            raise ValueError("Image too small to hold the encrypted data")
        
        flat_img = img_array.flatten()
        
        for i, bit in enumerate(data_binary):
            flat_img[i] = (flat_img[i] & 0xFE) | int(bit)
        
        modified_img_array = flat_img.reshape(img_array.shape)
        modified_img = Image.fromarray(modified_img_array.astype(np.uint8))
        modified_img.save(output_path)
    
    def extract_from_image(self, image_path):
        img = Image.open(image_path)
        img_array = np.array(img)
        flat_img = img_array.flatten()
        
        binary_data = ''
        delimiter = '1111111111111110'
        
        for pixel in flat_img:
            binary_data += str(pixel & 1)
            if binary_data.endswith(delimiter):
                binary_data = binary_data[:-len(delimiter)]
                break
        
        encrypted_data = bytearray()
        for i in range(0, len(binary_data), 8):
            if i + 8 <= len(binary_data):
                byte = binary_data[i:i+8]
                encrypted_data.append(int(byte, 2))
        
        return bytes(encrypted_data)
    
    def create_shares_for_decryption(self, combined_fingerprint_hex, fp1_hash, fp2_hash):
        shares = self.sss.split_secret(combined_fingerprint_hex, 2, 1)
        share_mapping = {
            fp1_hash: shares[0],
            fp2_hash: shares[1]
        }
        return share_mapping
    
    def decrypt_with_single_fingerprint(self, fingerprint_hex, share_mapping, encrypted_data):
        fp_hash = self.hash_fingerprint(fingerprint_hex)
        
        if fp_hash not in share_mapping:
            raise ValueError("Fingerprint not authorized for decryption")
        
        share = share_mapping[fp_hash]
        recovered_combined = self.sss.recover_secret([share])
        key = self.generate_encryption_key(recovered_combined)
        decrypted_data = self.decrypt_data(encrypted_data, key)
        
        return decrypted_data

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No command provided"}))
        return
    
    command = sys.argv[1]
    crypto_system = FingerprintCryptoSystem()
    
    try:
        if command == "encrypt":
            # python crypto_cli.py encrypt '{"fp1": "a501020326200121582048af9791f3345e88116ec9ef85297c5b1e87998f10bce7aabf2583551e536a7225820539e23d712f737c7dcfb9d164e5d17ee820b0b5e9c06111e59c6e0af81112fad", "fp2": "b602030427300232692159af9791f3345e88116ec9ef85297c5b1e87998f10bce7aabf2583551e536a8336930649e24e813f847c8edfb9e175f1f17fb920c0c5f0d07221f69d7f1bf91223fae", "message": "Hello World", "imagePath": "input.png", "outputPath": "output.png"}'
            data = json.loads(sys.argv[2])
            
            combined_fp, fp1_hash, fp2_hash = crypto_system.combine_fingerprints(data['fp1'], data['fp2'])
            encryption_key = crypto_system.generate_encryption_key(combined_fp)
            encrypted_message = crypto_system.encrypt_data(data['message'], encryption_key)
            
            share_mapping = crypto_system.create_shares_for_decryption(combined_fp, fp1_hash, fp2_hash)
            
            # Convert encrypted data to hex instead of base64
            storage_data = {
                'encrypted_data': crypto_system.bytes_to_hex(encrypted_message),
                'share_mapping': {k: list(v) for k, v in share_mapping.items()}
            }
            storage_bytes = json.dumps(storage_data).encode()
            
            crypto_system.embed_in_image(data['imagePath'], storage_bytes, data['outputPath'])
            
            print(json.dumps({"success": True, "message": "Data encrypted and embedded successfully"}))
            
        elif command == "decrypt":
            # python crypto_cli.py decrypt '{"fingerprint": "a501020326200121582048af9791f3345e88116ec9ef85297c5b1e87998f10bce7aabf2583551e536a7225820539e23d712f737c7dcfb9d164e5d17ee820b0b5e9c06111e59c6e0af81112fad", "imagePath": "output.png"}'
            data = json.loads(sys.argv[2])
            
            extracted_data = crypto_system.extract_from_image(data['imagePath'])
            extracted_json = json.loads(extracted_data.decode())
            
            # Convert hex back to bytes instead of base64 decode
            extracted_encrypted = crypto_system.hex_to_bytes(extracted_json['encrypted_data'])
            
            extracted_shares = {k: tuple(v) for k, v in extracted_json['share_mapping'].items()}
            
            decrypted_message = crypto_system.decrypt_with_single_fingerprint(
                data['fingerprint'], extracted_shares, extracted_encrypted
            )
            
            print(json.dumps({
                "success": True, 
                "message": decrypted_message.decode('utf-8')
            }))
            
        elif command == "encrypt_file":
            data = json.loads(sys.argv[2])
            
            with open(data['filePath'], 'rb') as f:
                file_data = f.read()
            
            combined_fp, fp1_hash, fp2_hash = crypto_system.combine_fingerprints(data['fp1'], data['fp2'])
            encryption_key = crypto_system.generate_encryption_key(combined_fp)
            encrypted_file = crypto_system.encrypt_data(file_data, encryption_key)
            
            share_mapping = crypto_system.create_shares_for_decryption(combined_fp, fp1_hash, fp2_hash)
            
            # Convert encrypted data to hex instead of base64
            storage_data = {
                'encrypted_data': crypto_system.bytes_to_hex(encrypted_file),
                'share_mapping': {k: list(v) for k, v in share_mapping.items()},
                'original_filename': os.path.basename(data['filePath'])
            }
            storage_bytes = json.dumps(storage_data).encode()
            
            crypto_system.embed_in_image(data['imagePath'], storage_bytes, data['outputPath'])
            
            print(json.dumps({"success": True, "message": "File encrypted and embedded successfully"}))
            
        elif command == "decrypt_file":
            data = json.loads(sys.argv[2])
            
            extracted_data = crypto_system.extract_from_image(data['imagePath'])
            extracted_json = json.loads(extracted_data.decode())
            
            # Convert hex back to bytes instead of base64 decode
            extracted_encrypted = crypto_system.hex_to_bytes(extracted_json['encrypted_data'])
            
            extracted_shares = {k: tuple(v) for k, v in extracted_json['share_mapping'].items()}
            
            decrypted_file = crypto_system.decrypt_with_single_fingerprint(
                data['fingerprint'], extracted_shares, extracted_encrypted
            )
            
            output_path = data.get('outputPath', extracted_json.get('original_filename', 'decrypted_file'))
            with open(output_path, 'wb') as f:
                f.write(decrypted_file)
            
            print(json.dumps({
                "success": True, 
                "message": "File decrypted successfully",
                "outputPath": output_path
            }))
            
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    main()