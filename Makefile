.PHONY: sync check

sync:
	./sync-to-wiki.sh

check:
	@status=0; \
	for d in plugins/hypergsd*; do \
		diff -rq "$$d" "/home/yan/tiddlywiki/plugins/$$(basename $$d)" || status=1; \
	done; \
	if [ $$status -eq 0 ]; then echo "wiki copy matches the repo"; else exit 1; fi
