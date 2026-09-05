"""Operator CLI. Public signup can never grant an administrator role."""
import argparse
import time

from .database import connect, initialize


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('username')
    args = parser.parse_args()
    initialize()
    with connect() as db:
        row = db.execute('SELECT id FROM accounts WHERE username=?', (args.username.lower(),)).fetchone()
        if row is None:
            raise SystemExit('Register this username first; no account was changed.')
        db.execute('INSERT OR IGNORE INTO admin_members VALUES (?,?)', (row['id'], int(time.time())))
    print('Administrator role granted. Reload the application.')
