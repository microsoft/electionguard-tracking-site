import { useCallback, useMemo, useRef, useState } from 'react';
import debounce from 'lodash/debounce';
import { useSearchBallots } from '../data/queries';
import { TrackedBallot } from '../models/tracking';

const DEFAULT_MINIMUM_QUERY_LENGTH = 3;
const DEFAULT_DEBOUNCE_TIME_MS = 250;

export interface SearchOptions {
    minimumQueryLength?: number;
    debounceTimeInMs?: number;
}

export interface Search {
    /** The latest search results, or an empty array */
    results: TrackedBallot[];
    /**
     * The search is being performed/updated.
     * Note that there can still be search results returned
     * while loading new ones.
     */
    isLoading: boolean;
    /** Perform a (debounced) search with a new query, when appropriate */
    search: (query: string) => void;
    /** Wipe the search input and results back to a clean slate */
    clear: () => void;
}

/**
 * Perform a debounced search for ballots by tracker code.
 */
export function useSearch(electionId: string, options: SearchOptions = {}): Search {
    const { minimumQueryLength = DEFAULT_MINIMUM_QUERY_LENGTH, debounceTimeInMs = DEFAULT_DEBOUNCE_TIME_MS } = options;

    const [query, setQuery] = useState<string>('');

    // Hold onto the latest non-empty search results.
    // This allows us to keep results displaying while more are being fetched
    const latestQuery = useRef<string>('');
    const latestResults = useRef<TrackedBallot[]>([]);

    // Prepare the query string to be searched
    const preparedQuery = prepareQuery(query);
    const isValidQuery = !!preparedQuery && preparedQuery.length >= minimumQueryLength;

    // Fetch query results (live or cached) for the query if valid.
    // If the query is not valid, the search results will be undefined and the state of the fetch
    // will be "idle".
    const { data: searchResults, isIdle, isLoading } = useSearchBallots(electionId, preparedQuery, isValidQuery);
    if (searchResults !== undefined) {
        latestQuery.current = query;
        latestResults.current = searchResults;
    }

    // Provide a function to trigger a debounced search
    const search = useMemo(() => debounce(setQuery, debounceTimeInMs), [debounceTimeInMs]);

    // Provide a function to wipe the search
    const clear = useCallback(() => {
        search.cancel();
        setQuery('');
    }, [search]);

    return {
        results: isValidQuery ? searchResults || latestResults.current : [],
        isLoading: isIdle || isLoading,
        search,
        clear,
    };
}

function prepareQuery(query: string) {
    return query?.replace(/-|\s+/g, '')?.toLowerCase();
}
