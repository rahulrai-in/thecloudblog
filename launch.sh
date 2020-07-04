# Update theme by executing the following command
# git submodule foreach --recursive git reset --hard
# git submodule foreach git pull origin master

cd tcb

./hugo_e_0.73.0 server --buildDrafts --disableFastRender --verbose
