#!/bin/bash
cd /vercel/share/v0-project
git fetch origin v0/postflow-421f9e88
git checkout v0/postflow-421f9e88 2>&1 || git checkout -b v0/postflow-421f9e88 origin/v0/postflow-421f9e88 2>&1
git log --oneline -3
echo "---"
echo "Current branch:"
git branch --show-current
