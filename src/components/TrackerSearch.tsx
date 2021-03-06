import React, { useEffect, useState } from 'react';
import { Label } from '@fluentui/react';
import { Theme, useTheme } from '@fluentui/react-theme-provider';
import Autosuggest, { InputProps } from 'react-autosuggest';
import { Route, Switch, useHistory, useParams, useRouteMatch } from 'react-router-dom';
import take from 'lodash/take';

import LargeCard from './LargeCard';
import { TrackedBallot } from '../models/tracking';
import TrackerDialog, { TrackerDialogStateOption } from './TrackerDialog';
import { useSearch } from './TrackerSearch.hooks';

const MAX_RESULTS_TO_SHOW = 5;

export interface TrackerSearchProps {
    electionId: string;
}

const fromTheme = (theme: Theme) => {
    const { palette, fonts, spacing, semanticColors, effects } = theme;
    return {
        container: {
            width: '100%',
        },
        input: {
            color: semanticColors.inputText,
            backgroundColor: semanticColors.inputBackground,
            padding: '2px 4px 1px 4px',
            borderRadius: effects.roundedCorner2,
            border: `1px solid ${semanticColors.inputBorder}`,
            height: 32,
            width: '100%',
            outline: 'none',
            fontFamily: fonts.medium.fontFamily,
            fontSize: fonts.medium.fontSize,
            fontColor: fonts.medium.color,
            maxWidth: 400,
        },
        inputOpen: { borderColor: semanticColors.inputBorderHovered },
        inputFocused: {
            borderColor: semanticColors.inputFocusBorderAlt,
            cornerRadius: effects.roundedCorner2,
        },
        suggestionsContainer: {
            padding: 0,
        },
        suggestionsContainerOpen: {
            maxWidth: 650,
            marginTop: 4,
            padding: 0,
            border: `1px solid ${semanticColors.disabledBorder}`,
        },
        suggestionsList: {
            margin: 0,
            padding: 0,
            fontFamily: fonts.medium.fontFamily,
            fontSize: fonts.medium.fontSize,
            fontColor: fonts.medium.color,
            listStyle: 'none',
        },
        suggestion: {
            padding: spacing.m,
            whiteSpace: 'nowrap' as 'nowrap', // # Fixes bug with react-autosuggest theme
            overflow: 'hidden',
            textOverflow: 'ellipsis',
        },
        suggestionHighlighted: {
            backgroundColor: palette.neutralLighterAlt,
        },
    };
};

const TrackerSearch: React.FunctionComponent<TrackerSearchProps> = ({ electionId }) => {
    const history = useHistory();
    const { path, url } = useRouteMatch();
    const theme = useTheme();

    // Track the raw input value from the user
    const [inputValue, setInputValue] = useState<string>('');
    const [selectedBallot, setSelectedBallot] = useState<TrackedBallot | undefined>();

    const { results, search, clear } = useSearch(electionId);

    // Wire up the input element to the search input value
    const inputProps: InputProps<TrackedBallot> = {
        placeholder: 'Enter your tracker code here',
        value: inputValue,
        onChange: (_event, { newValue }) => {
            setInputValue(newValue);
        },
    };

    return (
        <>
            <LargeCard alignToStart>
                <Label>Ballot Search</Label>
                <Autosuggest
                    theme={fromTheme(theme)}
                    suggestions={take(results, MAX_RESULTS_TO_SHOW)}
                    onSuggestionsFetchRequested={({ value }) => {
                        search(value);
                    }}
                    onSuggestionsClearRequested={() => {
                        setInputValue('');
                        clear();
                    }}
                    onSuggestionSelected={(_event, { suggestion }) => {
                        setSelectedBallot(suggestion);
                        const tracker = suggestion.tracker_words;
                        history.push(`${url}/track/${tracker}`);
                    }}
                    getSuggestionValue={(result) => result.tracker_words}
                    renderSuggestion={(result) => result.tracker_words}
                    inputProps={inputProps}
                />
                <Switch>
                    <Route
                        path={`${path}/track/:tracker`}
                        render={() => <TrackerResults parentPath={url} selectedBallot={selectedBallot} />}
                    />
                </Switch>
            </LargeCard>
        </>
    );
};

interface TrackerResultsProps {
    parentPath: string;
    selectedBallot: TrackedBallot | undefined;
}

/**
 * Displays a dialog of search results.
 *
 * If launched from a search, the selected ballot is provided directly.
 * Otherwise, it will need to trigger a search for the ballot.
 */
const TrackerResults: React.FunctionComponent<TrackerResultsProps> = ({ selectedBallot, parentPath }) => {
    const history = useHistory();
    const { electionId, tracker } = useParams<{ electionId: string; tracker: string }>();

    const { results, search, isLoading } = useSearch(electionId, { debounceTimeInMs: 0 });

    useEffect(() => {
        // If navigating directly to this route, we only have a tracker and must search for it
        if (!selectedBallot) {
            search(tracker);
        }
    }, [search, selectedBallot, tracker]);

    // Check for a ballot to display
    let existingBallot: TrackedBallot | undefined;
    if (selectedBallot) {
        existingBallot = selectedBallot;
    } else {
        existingBallot = results.find((ballot) => ballot.tracker_words === tracker);
    }

    const showLoading = !existingBallot && isLoading;
    let trackerState: TrackerDialogStateOption;
    if (showLoading) {
        trackerState = 'loading';
    } else if (existingBallot) {
        trackerState = existingBallot.state === 'Cast' ? 'confirmed' : 'spoiled';
    } else {
        trackerState = 'unknown';
    }

    return (
        <TrackerDialog
            hidden={false}
            tracker={tracker}
            trackerState={trackerState}
            onDismiss={() => {
                history.replace(parentPath);
            }}
        />
    );
};

export default TrackerSearch;
