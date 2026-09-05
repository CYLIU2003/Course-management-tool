"""Operator-only password recovery. Never put the new password in CLI arguments."""
import argparse
from getpass import getpass

from .accounts import PASSWORDS, validate_credentials
from .database import connect


def reset(username, password):
    username, password = validate_credentials(dict(username=username, password=password))
    encoded = PASSWORDS.hash(password)
    with connect() as db:
        db.execute('BEGIN IMMEDIATE')
        row = db.execute('SELECT id FROM accounts WHERE username=?', (username,)).fetchone()
        if row is None:
            raise ValueError('Account not found')
        db.execute('UPDATE accounts SET password_hash=? WHERE id=?', (encoded, row['id']))
        db.execute('DELETE FROM account_sessions WHERE account_id=?', (row['id'],))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('username')
    args = parser.parse_args()
    password = getpass('New password (12-128 characters): ')
    if password != getpass('Confirm password: '):
        raise SystemExit('Passwords do not match')
    reset(args.username, password)
    print('Password changed; all sessions revoked.')
