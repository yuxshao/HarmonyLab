\version "2.18.2" \language "english"
\markup {Complete the minor triad above the given root (in close position).}
theKey = { \key c \major }
\absolute { \theKey << { <d>1 } \\ { <f a> } >> }