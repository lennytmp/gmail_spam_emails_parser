# Parser of email addresses from spam folder

Dirty script which gets all email addresses from SPAM folder of a Gmail account. Uses oauth2 for authorisation.


## Instruction

First, CLIENT_ID, CLIENT_SECRET and callback_url should be specified.

Then the script should be run.

```bash
npm install
node main.js > /tmp/result.txt
```

This is an example of output format:
```
:: 1 // this is the number of emails parsed
test@example.com
::2
test2@example.com
test3@example.com
```
