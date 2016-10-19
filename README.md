# Mail a PDF Online

## Setup ([Dokku](http://dokku.viewdocs.io/dokku/))

- Install Ghostscript in your container
- Set the following required environment variables:
  - `LOB_API_KEY_TEST`
  - `LOB_API_KEY`
  - `STRIPE_API_KEY_TEST`
  - `STRIPE_API_KEY`
  - `SENDGRID_API_KEY`
  - `ADMIN_EMAIL` (email address for admin alerts)
- Set Nginx max upload size to the max upload size specified in (app.js) by following [this example](http://dokku.viewdocs.io/dokku/configuration/nginx/#customizing-via-configuration-files-included-by-the-default-tem)
- Set up a [one-off process](http://dokku.viewdocs.io/dokku/deployment/one-off-processes/) to delete old uploads. This example deletes files older than 1 day: `find static/uploads/* -mtime +1 -exec rm {} \;`. 

## Routes

- POST /upload
- POST /verify_address
- POST /checkout
- GET /track/{packageID}

## Todo

- Email sending
- Testing
- http://dokku.viewdocs.io/dokku/deployment/one-off-processes/