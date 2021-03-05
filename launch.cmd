# Update theme by executing the following command
# git submodule foreach --recursive git reset --hard
# git submodule foreach git pull origin master

# First pull? Execute the following to pull the submodule.
# git submodule update --init --recursive

cd tcb

hugo server --buildDrafts --disableFastRender --verbose

cd ..
