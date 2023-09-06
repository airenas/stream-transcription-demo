#!/bin/sh
echo Configuring BASE_HREF to "$BASE_HREF"
sed -i "s|<base href=\"/\">|<base href=\"$BASE_HREF\">|" /usr/share/nginx/html/index.html

echo Configuring KALDI_URL to "$KALDI_URL"
sed -i "s|KALDI_URL|$KALDI_URL|" /usr/share/nginx/html/index.html
echo Env conf done
